# @granola/api

API v1 de Granola con [Hono](https://hono.dev). Sin dependencia de Next: hoy la monta `apps/web/src/app/api/v1/[[...route]]/route.ts`, mañana puede correr en `apps/api`. Decisión y alcance: [ADR 0007](../../docs/adr/0007-hono-api-v1.md).

```
src/
  app.ts                 new Hono().basePath("/api/v1") + onError/notFound
  routes/health.ts       GET /health
  routes/public.ts       GET /public/:slug · GET /public/:slug/slots?serviceId&from&to
  routes/me.ts           GET /me · GET /me/appointments?from&to   (sesión)
  middleware/session.ts  requireSession: cookie o Authorization: Bearer (Better Auth)
  middleware/tenant.ts   requireNutritionist: user → nutritionist (401/403 JSON)
  middleware/rate-limit.ts  rateLimit({ limit, windowMs }) por IP + ruta
  rate-limit.ts          política async + checkRateLimit() (sin Hono ni DB)
  store.ts               RateLimitStore · MemoryStore · UpstashStore vía fetch
  queries/               acceso a DB (lo único que se mockea en tests)
```

- Errores: siempre `{ error: { code, message } }`.
- Validación: `validate(target, schema)` = `@hono/zod-validator` con el error uniforme.
- `@granola/api/rate-limit` es un subpath liviano (sin Hono ni DB) para las server actions anónimas de apps/web.
- Rate limit: ventanas fijas alineadas al epoch (cambia el algoritmo deslizante anterior). Con `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` usa Redis REST en cualquier entorno; sin alguna usa memoria compartida por proceso para dev/test. En producción sin configuración registra una sola vez `rate limit no distribuido`.
- `await checkRateLimit(key, { limit, windowMs })` registra cada intento, incluso si se rechaza. Las keys incluyen namespace, tamaño de ventana y bucket; `INCR` cuenta globalmente y `PEXPIRE NX` limpia la key sin extender la ventana. Cada intento usa un POST `/pipeline` y 2 comandos Redis. No hay SDK, reintentos automáticos ni Lua.
- Fail-open: errores de HTTP, red, JSON, comandos o timeout de **500 ms** (incluido leer el cuerpo) permiten continuar, devuelven cuota sin consumir y registran un warning sin IPs, keys ni secretos. Se vuelve a intentar Redis en la siguiente solicitud; no se cambia silenciosamente a un contador local.
- Rutas con middleware: `RateLimit-Limit`, `RateLimit-Remaining` y `RateLimit-Reset` (segundos hasta reset, redondeados hacia arriba); en 429 añade `Retry-After`. Durante fail-open: Remaining = Limit, Reset = 0 y sin Retry-After. Salud y rutas que no tenían rate limit conservan su política.
- `createRateLimiter({ store, now })` permite inyectar stores/reloj en tests. `reset()` y `size()` solo aplican al MemoryStore; nunca hacen FLUSHDB remoto. [ADR 0011](../../docs/adr/0011-rate-limit-store.md).

```bash
pnpm --filter @granola/api test
curl localhost:3100/api/v1/health
```
