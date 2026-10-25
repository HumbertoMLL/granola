import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRateLimiter } from "./rate-limit";
import { getRateLimitStore, MemoryStore, UpstashStore } from "./store";

beforeEach(() => {
  Reflect.deleteProperty(globalThis, Symbol.for("granola.api.rateLimitStore"));
});
afterEach(() => {
  vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe("MemoryStore", () => {
  it("incrementa sin mover el reset y abre una nueva ventana en el borde", async () => {
    let now = 1250;
    const store = new MemoryStore(() => now);
    expect(await store.incr("a", 1000)).toEqual({ count: 1, resetAt: 2000 });
    now = 1999;
    expect(await store.incr("a", 1000)).toEqual({ count: 2, resetAt: 2000 });
    expect(await store.incr("b", 1000)).toEqual({ count: 1, resetAt: 2000 });
    now = 2000;
    expect(await store.incr("a", 1000)).toEqual({ count: 1, resetAt: 3000 });
  });

  it("aisla ventanas de distinto tamaño y permite reset por llave", async () => {
    const store = new MemoryStore(() => 0);
    await store.incr("a", 1000);
    await store.incr("a", 2000);
    await store.incr("b", 1000);
    store.reset("a");
    expect(store.size()).toBe(1);
    expect(await store.incr("a", 2000)).toEqual({ count: 1, resetAt: 2000 });
    expect((await store.incr("b", 1000)).count).toBe(2);
    store.reset();
    expect(store.size()).toBe(0);
  });

  it("barre llaves caducadas para limitar la memoria de desarrollo", async () => {
    let now = 0;
    const store = new MemoryStore(() => now);
    await store.incr("expired", 1000);
    now = 1000;
    for (let i = 0; i < 499; i++) await store.incr("live", 1000);
    expect(store.size()).toBe(1);
  });
});

describe("UpstashStore", () => {
  const url = "https://redis.example";
  const token = "private-token";
  const now = () => 1250;
  const options = { limit: 2, windowMs: 1000 };
  const response = (payload: unknown) => new Response(JSON.stringify(payload));

  it("envía INCR y PEXPIRE NX al pipeline REST con bearer y valida count", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response([{ result: 1 }, { result: 1 }]));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new UpstashStore(`${url}/`, token, now).incr("route:ip", 1000);
    expect(result).toEqual({ count: 1, resetAt: 2000 });
    const key = "granola:ratelimit:1000:1:route:ip";
    expect(fetchMock).toHaveBeenCalledWith(`${url}/pipeline`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["INCR", key], ["PEXPIRE", key, 750, "NX"]]),
      cache: "no-store", signal: expect.any(AbortSignal),
    });
  });

  it("comparte la cubeta entre instancias y no extiende la ventana en nuevos hits", async () => {
    let time = 1250;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response([{ result: 1 }, { result: 1 }]))
      .mockResolvedValueOnce(response([{ result: 2 }, { result: 0 }]))
      .mockResolvedValueOnce(response([{ result: 1 }, { result: 1 }]));
    vi.stubGlobal("fetch", fetchMock);
    const first = new UpstashStore(url, token, () => time);
    const second = new UpstashStore(url, token, () => time);
    await first.incr("a", 1000);
    time = 1750;
    expect(await second.incr("a", 1000)).toEqual({ count: 2, resetAt: 2000 });
    time = 2000;
    expect(await first.incr("a", 1000)).toEqual({ count: 1, resetAt: 3000 });
    const commands = fetchMock.mock.calls.map((call) => JSON.parse((call[1] as RequestInit).body as string) as [string[], (string | number)[]]);
    expect(commands[0]![0][1]).toBe(commands[1]![0][1]);
    expect(commands[2]![0][1]).not.toBe(commands[0]![0][1]);
    expect(commands[1]![1].slice(2)).toEqual([250, "NX"]);
  });

  it.each([
    ["error HTTP", () => new Response("unavailable", { status: 503 })],
    ["error del INCR", () => response([{ error: "secret provider error" }, { result: 1 }])],
    ["error del PEXPIRE", () => response([{ result: 1 }, { error: "invalid expiry" }])],
    ["contador inválido", () => response([{ result: -1 }, { result: 1 }])],
    ["JSON inválido", () => new Response("not-json")],
    ["respuesta incompleta", () => response([{ result: 1 }])],
  ])("fail-open ante %s sin filtrar datos del proveedor", async (_name, makeResponse) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makeResponse()));
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const limiter = createRateLimiter({ store: new UpstashStore(url, token, now), now });
    expect(await limiter.check("private-ip", options)).toEqual({ ok: true, limit: 2, remaining: 2, resetAt: 1250, retryAfterMs: 0 });
    expect(log).toHaveBeenCalledWith("[rate-limit] store no disponible; fail-open", { reason: "store_error" });
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|secret|redis.example/);
  });

  it("fail-open ante error de red y vuelve a consultar Redis en el siguiente hit", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error(`network ${token}`))
      .mockResolvedValueOnce(response([{ result: 3 }, { result: 1 }]));
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const limiter = createRateLimiter({ store: new UpstashStore(url, token, now), now });
    expect((await limiter.check("a", options)).ok).toBe(true);
    expect((await limiter.check("a", options)).ok).toBe(false);
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toContain(token);
  });

  it.each(["fetch", "body"] as const)("fail-open a los 500 ms si %s no termina, incluso sin respetar abort", async (phase) => {
    vi.useFakeTimers(); vi.setSystemTime(1250);
    const never = new Promise<never>(() => {});
    const fetchMock = vi.fn().mockImplementation(() => phase === "fetch" ? never : Promise.resolve({ ok: true, json: () => never }));
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const limiter = createRateLimiter({ store: new UpstashStore(url, token) });
    const checked = limiter.check("a", options);
    let finished = false;
    void checked.then(() => { finished = true; });
    await vi.advanceTimersByTimeAsync(499);
    expect(finished).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await checked).toMatchObject({ ok: true, remaining: 2, retryAfterMs: 0 });
    expect((fetchMock.mock.calls[0]![1] as RequestInit).signal?.aborted).toBe(true);
    expect(log).toHaveBeenCalledWith("[rate-limit] store no disponible; fail-open", { reason: "timeout" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("limpia el temporizador después de una respuesta exitosa", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response([{ result: 1 }, { result: 1 }])));
    await new UpstashStore(url, token, now).incr("a", 1000);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("selección por entorno", () => {
  it.each([undefined, "development", "test"])("usa memoria sin credenciales en %s", (env) => {
    vi.stubEnv("NODE_ENV", env); vi.stubEnv("UPSTASH_REDIS_REST_URL", ""); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getRateLimitStore()).toBeInstanceOf(MemoryStore);
    expect(log).not.toHaveBeenCalled();
  });

  it("selecciona Upstash con ambas variables y reutiliza el adaptador", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example"); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    const store = getRateLimitStore();
    expect(store).toBeInstanceOf(UpstashStore);
    expect(getRateLimitStore()).toBe(store);
  });

  it("advierte también si otro bundle creó antes el store de memoria", async () => {
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("UPSTASH_REDIS_REST_URL", ""); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const first = getRateLimitStore();
    vi.resetModules();
    const secondModule = await import("./store");
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(secondModule.getRateLimitStore()).toBe(first);
    expect(log).toHaveBeenCalledExactlyOnceWith("[rate-limit] rate limit no distribuido");
  });

  it("avisa una sola vez en producción con configuración incompleta", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example"); vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getRateLimitStore()).toBeInstanceOf(MemoryStore);
    getRateLimitStore();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    getRateLimitStore();
    expect(log).toHaveBeenCalledExactlyOnceWith("[rate-limit] rate limit no distribuido");
  });
});
