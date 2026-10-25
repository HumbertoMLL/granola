import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { rateLimit } from "./middleware/rate-limit";
import { checkRateLimit, clientIpFromHeaders, createRateLimiter, getDefaultRateLimiter } from "./rate-limit";
import { UpstashStore } from "./store";

function clock(start = 1_020_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => { t += ms; } };
}

beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("createRateLimiter (ventana fija)", () => {
  const opts = { limit: 3, windowMs: 60_000 };

  it("deja pasar hasta limit hits y bloquea el siguiente", async () => {
    const c = clock();
    const rl = createRateLimiter({ now: c.now });
    expect(await rl.check("k", opts)).toMatchObject({ ok: true, remaining: 2 });
    expect(await rl.check("k", opts)).toMatchObject({ ok: true, remaining: 1 });
    expect(await rl.check("k", opts)).toMatchObject({ ok: true, remaining: 0 });
    expect(await rl.check("k", opts)).toMatchObject({ ok: false, remaining: 0, retryAfterMs: 60_000 });
  });

  it("las llaves son independientes", async () => {
    const rl = createRateLimiter({ now: clock().now });
    for (let i = 0; i < 3; i++) await rl.check("a", opts);
    expect((await rl.check("a", opts)).ok).toBe(false);
    expect((await rl.check("b", opts)).ok).toBe(true);
  });

  it("la ventana fija libera toda la cuota en el límite exacto", async () => {
    const c = clock();
    const rl = createRateLimiter({ now: c.now });
    await rl.check("k", opts);
    c.advance(20_000);
    await rl.check("k", opts);
    c.advance(20_000);
    await rl.check("k", opts);
    expect((await rl.check("k", opts)).ok).toBe(false);
    c.advance(19_999);
    expect(await rl.check("k", opts)).toMatchObject({ ok: false, retryAfterMs: 1 });
    c.advance(1);
    expect(await rl.check("k", opts)).toMatchObject({ ok: true, remaining: 2 });
  });

  it("los hits bloqueados no alargan el castigo", async () => {
    const c = clock();
    const rl = createRateLimiter({ now: c.now });
    for (let i = 0; i < 13; i++) await rl.check("k", opts);
    c.advance(60_000);
    expect(await rl.check("k", opts)).toMatchObject({ ok: true, remaining: 2 });
  });

  it("reset borra una llave o todo el store de memoria", async () => {
    const rl = createRateLimiter({ now: clock().now });
    for (let i = 0; i < 3; i++) {
      await rl.check("a", opts);
      await rl.check("b", opts);
    }
    rl.reset("a");
    expect((await rl.check("a", opts)).ok).toBe(true);
    expect((await rl.check("b", opts)).ok).toBe(false);
    rl.reset();
    expect(rl.size()).toBe(0);
    expect((await rl.check("b", opts)).ok).toBe(true);
  });

  it.each([{ limit: 0, windowMs: 1000 }, { limit: 1, windowMs: 0 }, { limit: 1.5, windowMs: 1000 }])("rechaza opciones inválidas sin fail-open: %j", async (options) => {
    const store = { incr: vi.fn() };
    await expect(createRateLimiter({ store }).check("k", options)).rejects.toThrow();
    expect(store.incr).not.toHaveBeenCalled();
  });
});

describe("checkRateLimit (store seleccionado por entorno)", () => {
  it("comparte estado entre llamadas", async () => {
    getDefaultRateLimiter().reset();
    const opts = { limit: 2, windowMs: 60_000 };
    expect((await checkRateLimit("shared", opts)).ok).toBe(true);
    expect((await checkRateLimit("shared", opts)).ok).toBe(true);
    expect((await checkRateLimit("shared", opts)).ok).toBe(false);
    getDefaultRateLimiter().reset();
  });
});

describe("clientIpFromHeaders", () => {
  it("usa el primer valor de x-forwarded-for", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });
  it("cae a x-real-ip y luego a unknown", () => {
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8");
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("middleware rateLimit", () => {
  function build() {
    const limiter = createRateLimiter();
    return new Hono().get("/x/:id", rateLimit({ limit: 2, windowMs: 60_000, limiter }), (c) => c.json({ ok: true }));
  }

  it("responde 429 con error uniforme y headers al pasarse", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_020_000);
    const app = build();
    const h = { "x-forwarded-for": "9.9.9.9" };
    const r1 = await app.request("/x/1", { headers: h });
    expect(r1.status).toBe(200);
    expect(r1.headers.get("RateLimit-Limit")).toBe("2");
    expect(r1.headers.get("RateLimit-Remaining")).toBe("1");
    expect(r1.headers.get("RateLimit-Reset")).toBe("60");
    expect(r1.headers.get("Retry-After")).toBeNull();
    expect((await app.request("/x/2", { headers: h })).status).toBe(200);
    vi.setSystemTime(1_020_001);
    const r3 = await app.request("/x/3", { headers: h });
    expect(r3.status).toBe(429);
    expect(r3.headers.get("RateLimit-Limit")).toBe("2");
    expect(r3.headers.get("RateLimit-Remaining")).toBe("0");
    expect(r3.headers.get("RateLimit-Reset")).toBe("60");
    expect(r3.headers.get("Retry-After")).toBe("60");
    expect(await r3.json()).toEqual({ error: { code: "rate_limited", message: expect.any(String) } });
  });

  it("cuenta por IP", async () => {
    const app = build();
    for (let i = 0; i < 2; i++) await app.request("/x/1", { headers: { "x-forwarded-for": "1.1.1.1" } });
    expect((await app.request("/x/1", { headers: { "x-forwarded-for": "1.1.1.1" } })).status).toBe(429);
    expect((await app.request("/x/1", { headers: { "x-forwarded-for": "2.2.2.2" } })).status).toBe(200);
  });

  it("espera un store remoto y emite los mismos headers", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(1_020_000);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ result: 3 }, { result: 0 }])));
    vi.stubGlobal("fetch", fetchMock);
    const limiter = createRateLimiter({ store: new UpstashStore("https://redis.example", "secret") });
    const app = new Hono().get("/x", rateLimit({ limit: 2, windowMs: 60_000, limiter }), (c) => c.text("ok"));
    const res = await app.request("/x");
    expect(res.status).toBe(429);
    expect(res.headers.get("RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("RateLimit-Reset")).toBe("60");
    expect(res.headers.get("Retry-After")).toBe("60");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("permite continuar si Redis falla y mantiene headers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("no network")));
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const limiter = createRateLimiter({ store: new UpstashStore("https://redis.example", "secret") });
    const app = new Hono().get("/x", rateLimit({ limit: 2, windowMs: 60_000, limiter }), (c) => c.text("ok"));
    const res = await app.request("/x");
    expect(res.status).toBe(200);
    expect(res.headers.get("RateLimit-Limit")).toBe("2");
    expect(res.headers.get("RateLimit-Remaining")).toBe("2");
    expect(res.headers.get("RateLimit-Reset")).toBe("0");
    expect(res.headers.get("Retry-After")).toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });
});
