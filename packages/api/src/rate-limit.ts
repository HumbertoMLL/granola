/** Rate limit async compartido por Hono y server actions. Ver ADR 0011. */
import { z } from "zod";
import { getRateLimitStore, MemoryStore, RateLimitTimeoutError, type RateLimitStore } from "./store";

export type RateLimitOptions = { limit: number; windowMs: number };
export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms del fin de la ventana fija actual. */
  resetAt: number;
  retryAfterMs: number;
};
export type RateLimiter = {
  check(key: string, options: RateLimitOptions): Promise<RateLimitResult>;
};

const optionsSchema = z.object({
  limit: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  windowMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});

export function createRateLimiter(opts: { now?: () => number; store?: RateLimitStore } = {}) {
  const now = opts.now ?? Date.now;
  const store = opts.store ?? new MemoryStore(now);
  return {
    async check(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
      // Errores de programación no deben convertirse en fail-open.
      const { limit, windowMs } = optionsSchema.parse(options);
      try {
        const { count, resetAt } = await store.incr(key, windowMs);
        const ok = count <= limit;
        return { ok, limit, remaining: Math.max(0, limit - count), resetAt, retryAfterMs: ok ? 0 : Math.max(0, resetAt - now()) };
      } catch (error) {
        // No registrar llaves/IPs, tokens, URL ni el error crudo del proveedor.
        console.warn("[rate-limit] store no disponible; fail-open", { reason: error instanceof RateLimitTimeoutError ? "timeout" : "store_error" });
        return { ok: true, limit, remaining: limit, resetAt: now(), retryAfterMs: 0 };
      }
    },
    /** Compatibilidad de tests: limpieza solo para el adaptador de memoria. */
    reset(key?: string): void {
      if (!(store instanceof MemoryStore)) throw new Error("reset solo está disponible en memoria");
      store.reset(key);
    },
    size(): number {
      if (!(store instanceof MemoryStore)) throw new Error("size solo está disponible en memoria");
      return store.size();
    },
  };
}

export function getDefaultRateLimiter() {
  return createRateLimiter({ store: getRateLimitStore() });
}

export async function checkRateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  return getDefaultRateLimiter().check(key, options);
}

/** Límite por defecto para acciones anónimas (agendar, cancelar, reseñar). */
export const ANON_ACTION_LIMIT: RateLimitOptions = { limit: 10, windowMs: 60_000 };

export const RATE_LIMIT_MESSAGE = "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";

/** IP del cliente a partir de los headers (primer valor de x-forwarded-for). */
export function clientIpFromHeaders(headers: Headers): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || headers.get("x-real-ip")?.trim() || "unknown";
}
