import { Hono } from "hono";
import { describe, expect, it } from "vitest";

import { rateLimit } from "./middleware/rate-limit";
import { checkRateLimit, clientIpFromHeaders, createRateLimiter, getDefaultRateLimiter } from "./rate-limit";

function clock(start = 1_000_000) {
  let t = start;
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("createRateLimiter (ventana deslizante)", () => {
  const opts = { limit: 3, windowMs: 60_000 };

  it("deja pasar hasta `limit` hits y bloquea el siguiente", () => {
    const c = clock();
    const rl = createRateLimiter({ now: c.now });
    expect(rl.check("k", opts)).toMatchObject({ ok: true, remaining: 2 });
    expect(rl.check("k", opts)).toMatchObject({ ok: true, remaining: 1 });
    expect(rl.check("k", opts)).toMatchObject({ ok: true, remaining: 0 });
    const blocked = rl.check("k", opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBe(60_000);
  });

  it("las llaves son independientes", () => {
    const rl = createRateLimiter({ now: clock().now });
    for (let i = 0; i < 3; i++) rl.check("a", opts);
    expect(rl.check("a", opts).ok).toBe(false);
    expect(rl.check("b", opts).ok).toBe(true);
  });

  it("la ventana se desliza: libera hits conforme salen de la ventana", () => {
    const c = clock();
    const rl = createRateLimiter({ now: c.now });
    rl.check("k", opts); // t=0
    c.advance(20_000);
    rl.check("k", opts); // t=20s
    c.advance(20_000);
    rl.check("k", opts); // t=40s
    expect(rl.check("k", opts).ok).toBe(false);

    // A los 59.999s el primer hit sigue dentro.
    c.advance(19_999);
    const still = rl.check("k", opts);
    expect(still.ok).toBe(false);
    expect(still.retryAfterMs).toBe(1);

    // A los 60s sale el primero: cabe exactamente uno más.
    c.advance(1);
    expect(rl.check("k", opts).ok).toBe(true);
    expect(rl.check("k", opts).ok).toBe(false);
  });

  it("los hits bloqueados no cuentan (no alargan el castigo)", () => {
    const c = clock();
    const rl = createRateLimiter({ now: c.now });
    for (let i = 0; i < 3; i++) rl.check("k", opts);
    for (let i = 0; i < 10; i++) rl.check("k", opts);
    c.advance(60_000);
    expect(rl.check("k", opts)).toMatchObject({ ok: true, remaining: 2 });
  });

  it("reset borra una llave o todo el store", () => {
    const rl = createRateLimiter({ now: clock().now });
    for (let i = 0; i < 3; i++) {
      rl.check("a", opts);
      rl.check("b", opts);
    }
    rl.reset("a");
    expect(rl.check("a", opts).ok).toBe(true);
    expect(rl.check("b", opts).ok).toBe(false);
    rl.reset();
    expect(rl.size()).toBe(0);
    expect(rl.check("b", opts).ok).toBe(true);
  });

  it("rechaza opciones inválidas", () => {
    const rl = createRateLimiter();
    expect(() => rl.check("k", { limit: 0, windowMs: 1000 })).toThrow();
    expect(() => rl.check("k", { limit: 1, windowMs: 0 })).toThrow();
  });
});

describe("checkRateLimit (store compartido del proceso)", () => {
  it("comparte estado entre llamadas", () => {
    getDefaultRateLimiter().reset();
    const opts = { limit: 2, windowMs: 60_000 };
    expect(checkRateLimit("shared", opts).ok).toBe(true);
    expect(checkRateLimit("shared", opts).ok).toBe(true);
    expect(checkRateLimit("shared", opts).ok).toBe(false);
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
    const app = new Hono().get("/x/:id", rateLimit({ limit: 2, windowMs: 60_000, limiter }), (c) => c.json({ ok: true }));
    return app;
  }

  it("responde 429 con error uniforme y headers al pasarse", async () => {
    const app = build();
    const h = { "x-forwarded-for": "9.9.9.9" };
    const r1 = await app.request("/x/1", { headers: h });
    expect(r1.status).toBe(200);
    expect(r1.headers.get("RateLimit-Limit")).toBe("2");
    expect(r1.headers.get("RateLimit-Remaining")).toBe("1");
    // Misma ruta (patrón), distinto parámetro: misma cubeta.
    expect((await app.request("/x/2", { headers: h })).status).toBe(200);
    const r3 = await app.request("/x/3", { headers: h });
    expect(r3.status).toBe(429);
    expect(r3.headers.get("Retry-After")).toBe("60");
    expect(await r3.json()).toEqual({ error: { code: "rate_limited", message: expect.any(String) } });
  });

  it("cuenta por IP", async () => {
    const app = build();
    for (let i = 0; i < 2; i++) await app.request("/x/1", { headers: { "x-forwarded-for": "1.1.1.1" } });
    expect((await app.request("/x/1", { headers: { "x-forwarded-for": "1.1.1.1" } })).status).toBe(429);
    expect((await app.request("/x/1", { headers: { "x-forwarded-for": "2.2.2.2" } })).status).toBe(200);
  });
});
