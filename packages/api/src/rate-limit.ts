/**
 * Limitador en memoria con ventana deslizante (sliding log): por cada llave se
 * guardan los timestamps de los hits dentro de la ventana.
 *
 * Sin dependencias de Hono ni de Next: lo usan el middleware de `/api/v1` y las
 * server actions anónimas de apps/web (`@granola/api/rate-limit`).
 *
 * OJO multi-instancia: el estado vive en la memoria del proceso. En Vercel cada
 * instancia serverless tiene su propio contador, así que el límite real es
 * `limit × instancias calientes`. Sirve como freno contra abuso tonto (scripts,
 * dobles clics, bots baratos), no como garantía. Para un límite global hay que
 * pasar el store a KV/Upstash Redis (`@upstash/ratelimit` tiene el mismo
 * algoritmo de ventana deslizante) detrás de esta misma interfaz.
 */

export type RateLimitOptions = {
  /** Hits permitidos dentro de la ventana. */
  limit: number;
  /** Tamaño de la ventana deslizante en ms. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  /** Hits restantes en la ventana actual (0 si se bloqueó). */
  remaining: number;
  /** Epoch ms en que se libera el siguiente hit. */
  resetAt: number;
  /** ms a esperar antes de reintentar (0 si ok). */
  retryAfterMs: number;
};

export type RateLimiter = {
  check(key: string, options: RateLimitOptions): RateLimitResult;
  /** Borra una llave o todo el store (tests). */
  reset(key?: string): void;
  /** Número de llaves vivas (tests / diagnóstico). */
  size(): number;
};

/** Cada cuántas llamadas se barren llaves sin hits recientes. */
const SWEEP_EVERY = 500;

export function createRateLimiter(opts: { now?: () => number } = {}): RateLimiter {
  const now = opts.now ?? Date.now;
  const hits = new Map<string, number[]>();
  /** Ventana más grande vista por llave, para saber cuándo se puede borrar. */
  const windows = new Map<string, number>();
  let calls = 0;

  function sweep(t: number) {
    for (const [key, list] of hits) {
      const w = windows.get(key) ?? 0;
      const last = list[list.length - 1];
      if (last === undefined || last <= t - w) {
        hits.delete(key);
        windows.delete(key);
      }
    }
  }

  return {
    check(key, { limit, windowMs }) {
      if (!Number.isFinite(limit) || limit < 1) throw new Error("rate limit: `limit` debe ser >= 1");
      if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error("rate limit: `windowMs` debe ser > 0");

      const t = now();
      if (++calls % SWEEP_EVERY === 0) sweep(t);

      const cutoff = t - windowMs;
      const list = (hits.get(key) ?? []).filter((ts) => ts > cutoff);
      windows.set(key, Math.max(windows.get(key) ?? 0, windowMs));

      if (list.length >= limit) {
        hits.set(key, list);
        const oldest = list[0] ?? t;
        const resetAt = oldest + windowMs;
        return { ok: false, limit, remaining: 0, resetAt, retryAfterMs: Math.max(0, resetAt - t) };
      }

      list.push(t);
      hits.set(key, list);
      const oldest = list[0] ?? t;
      return { ok: true, limit, remaining: limit - list.length, resetAt: oldest + windowMs, retryAfterMs: 0 };
    },
    reset(key) {
      if (key === undefined) {
        hits.clear();
        windows.clear();
      } else {
        hits.delete(key);
        windows.delete(key);
      }
    },
    size() {
      return hits.size;
    },
  };
}

// Un solo store por proceso. Se cuelga de globalThis porque Next/Turbopack puede
// evaluar este módulo más de una vez (route handler vs server actions, HMR en dev).
const GLOBAL_KEY = Symbol.for("granola.api.rateLimiter");
type GlobalWithLimiter = typeof globalThis & { [GLOBAL_KEY]?: RateLimiter };

export function getDefaultRateLimiter(): RateLimiter {
  const g = globalThis as GlobalWithLimiter;
  g[GLOBAL_KEY] ??= createRateLimiter();
  return g[GLOBAL_KEY];
}

/** Registra un hit para `key` en el store compartido del proceso. */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
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
