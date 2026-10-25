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
  rate-limit.ts          limitador en memoria (ventana deslizante) + checkRateLimit()
  queries/               acceso a DB (lo único que se mockea en tests)
```

- Errores: siempre `{ error: { code, message } }`.
- Validación: `validate(target, schema)` = `@hono/zod-validator` con el error uniforme.
- `@granola/api/rate-limit` es un subpath liviano (sin Hono ni DB) para las server actions anónimas de apps/web.
- Rate limit en memoria = por instancia. En multi-instancia pasarlo a KV/Upstash (ver comentario en `rate-limit.ts`).

```bash
pnpm --filter @granola/api test
curl localhost:3100/api/v1/health
```
