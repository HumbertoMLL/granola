import { z } from "zod";

export type RateLimitEntry = { count: number; resetAt: number };
export interface RateLimitStore {
  incr(key: string, windowMs: number): Promise<RateLimitEntry>;
}

const windowSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/** Ventanas fijas alineadas al epoch; el tamaño forma parte de la llave. */
function windowFor(key: string, windowMs: number, now: number) {
  windowSchema.parse(windowMs);
  const bucket = Math.floor(now / windowMs);
  return { key: `granola:ratelimit:${windowMs}:${bucket}:${key}`, resetAt: (bucket + 1) * windowMs };
}

export class MemoryStore implements RateLimitStore {
  private readonly entries = new Map<string, RateLimitEntry & { owner: string }>();
  private calls = 0;

  constructor(private readonly now: () => number = Date.now) {}

  async incr(key: string, windowMs: number): Promise<RateLimitEntry> {
    const time = this.now();
    if (++this.calls % 500 === 0) {
      for (const [k, entry] of this.entries) if (entry.resetAt <= time) this.entries.delete(k);
    }
    const window = windowFor(key, windowMs, time);
    const count = (this.entries.get(window.key)?.count ?? 0) + 1;
    this.entries.set(window.key, { owner: key, count, resetAt: window.resetAt });
    return { count, resetAt: window.resetAt };
  }

  /** Diagnóstico y limpieza de tests; no hace FLUSHDB en Redis. */
  reset(key?: string): void {
    if (key === undefined) this.entries.clear();
    else for (const [k, entry] of this.entries) if (entry.owner === key) this.entries.delete(k);
  }

  size(): number { return this.entries.size; }
}

const pipelineSchema = z.tuple([
  z.object({ result: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict(),
  z.object({ result: z.union([z.literal(0), z.literal(1)]) }).strict(),
]);

export const UPSTASH_TIMEOUT_MS = 500;
export class RateLimitTimeoutError extends Error {
  constructor() { super("rate limit store timeout"); }
}

export class UpstashStore implements RateLimitStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly now: () => number = Date.now,
  ) {}

  async incr(key: string, windowMs: number): Promise<RateLimitEntry> {
    const time = this.now();
    const window = windowFor(key, windowMs, time);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Race limita también body/json y clientes fetch que no respeten AbortSignal.
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new RateLimitTimeoutError());
        controller.abort();
      }, UPSTASH_TIMEOUT_MS);
    });
    try {
      return await Promise.race([
        (async () => {
          const response = await fetch(`${this.url.replace(/\/+$/, "")}/pipeline`, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
            body: JSON.stringify([
              ["INCR", window.key],
              ["PEXPIRE", window.key, window.resetAt - time, "NX"],
            ]),
            signal: controller.signal,
            cache: "no-store",
          });
          if (!response.ok) throw new Error("rate limit store HTTP error");
          const payload: unknown = await response.json();
          const parsed = pipelineSchema.parse(payload);
          return { count: parsed[0].result, resetAt: window.resetAt };
        })(),
        timeout,
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}

// Solo se comparte el adaptador por proceso. Con Redis los contadores viven fuera
// de la instancia; memoria es el fallback explícito para dev/test o mala config.
const GLOBAL_KEY = Symbol.for("granola.api.rateLimitStore");
type StoreState = { url?: string; token?: string; store: RateLimitStore; warned: boolean };
type StoreGlobal = typeof globalThis & { [GLOBAL_KEY]?: StoreState };

export function getRateLimitStore(): RateLimitStore {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || undefined;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || undefined;
  const global = globalThis as StoreGlobal;
  const previous = global[GLOBAL_KEY];
  if (!previous || previous.url !== url || previous.token !== token) {
    global[GLOBAL_KEY] = { url, token, store: url && token ? new UpstashStore(url, token) : new MemoryStore(), warned: previous?.warned ?? false };
  }
  const state = global[GLOBAL_KEY]!;
  if (!(url && token) && process.env.NODE_ENV === "production" && !state.warned) {
    state.warned = true;
    console.warn("[rate-limit] rate limit no distribuido");
  }
  return state.store;
}
