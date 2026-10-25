import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

import { apiError } from "../errors";
import {
  clientIpFromHeaders,
  getDefaultRateLimiter,
  RATE_LIMIT_MESSAGE,
  type RateLimiter,
  type RateLimitOptions,
} from "../rate-limit";

export type RateLimitMiddlewareOptions = RateLimitOptions & {
  /** Prefijo de la llave. Default: el patrón de la ruta (`/api/v1/public/:slug`). */
  prefix?: string;
  /** Llave custom (p. ej. por usuario en vez de IP). Default: IP del cliente. */
  key?: (c: Context) => string;
  /** Store a usar (tests). Default: el compartido del proceso. */
  limiter?: RateLimiter;
};

/**
 * Rate limit por IP + ruta con ventana deslizante. Pone los headers
 * `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (segundos) y, al
 * bloquear, `Retry-After` + 429 `{ error: { code: "rate_limited" } }`.
 *
 * En memoria: ver la nota de multi-instancia en `../rate-limit.ts` (hay que
 * pasarlo a KV/Upstash cuando corra en más de una instancia).
 */
export function rateLimit(options: RateLimitMiddlewareOptions) {
  const { limit, windowMs, prefix, key, limiter } = options;
  return createMiddleware(async (c, next) => {
    const store = limiter ?? getDefaultRateLimiter();
    const who = key ? key(c) : clientIpFromHeaders(c.req.raw.headers);
    const scope = prefix ?? c.req.routePath;
    const result = store.check(`${scope}:${who}`, { limit, windowMs });

    const resetSec = Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000));
    c.header("RateLimit-Limit", String(result.limit));
    c.header("RateLimit-Remaining", String(result.remaining));
    c.header("RateLimit-Reset", String(resetSec));

    if (!result.ok) {
      c.header("Retry-After", String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))));
      return apiError(c, 429, "rate_limited", RATE_LIMIT_MESSAGE);
    }
    await next();
  });
}
