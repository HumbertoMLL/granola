# ADR 0007 — API v1 con Hono, montada dentro de Next

**Fecha:** 2026-10-24 · **Estado:** propuesto (pendiente de visto bueno de Beto)

## Contexto

- Hoy toda la lógica de servidor vive en **server actions** (panel y páginas públicas) y en **route handlers** sueltos (webhooks, Inngest, Stripe Connect, Better Auth). Funciona bien para la web, pero:
  - La **app Expo** (F5, `apps/mobile`) no puede llamar server actions: necesita HTTP estable, versionado y con auth por token.
  - Las acciones **anónimas** (agendar, cancelar/reagendar por token, reseña) no tenían ningún freno contra abuso.
- Regla dura #1: los datos de salud solo salen por la API filtrados por `nutritionist_id` de la sesión. Una API explícita hace esa frontera visible y testeable.
- No queremos otro deploy ni otro dominio todavía (Vercel Hobby/Pro, un solo proyecto).

## Decisión

1. **Hono** como framework de la API propia, en un paquete nuevo **`packages/api` (`@granola/api`) sin dependencia de Next**. `app.ts` = `new Hono().basePath("/api/v1")` con rutas `health`, `public/*` y `me/*`.
2. **Hoy se monta dentro de Next**: `apps/web/src/app/api/v1/[[...route]]/route.ts` con `handle(app)` de **`@hono/vercel`** (el adaptador `hono/vercel` está deprecado desde Hono 4.13 y desaparece en v5). Mismo deploy, mismo dominio, mismas env vars. Runtime Node (default; con `cacheComponents` no se declara `runtime`).
   - Next resuelve primero los segmentos estáticos, así que `/api/auth`, `/api/webhooks/*`, `/api/inngest` y `/api/connect/*` no se tocan.
3. **Cuando salgamos de Vercel** (F1.5 Docker / VPS / Fly) o la API necesite escalar aparte: `apps/api` con `@hono/node-server` importando el mismo `app`. Cero cambios en `packages/api`.
4. **Auth**: Better Auth sigue siendo la única fuente. `requireSession` llama `auth.api.getSession({ headers })`, que acepta **cookie** (web) o **`Authorization: Bearer <token>`** (Expo) gracias al plugin `bearer()` agregado en `packages/auth`. El token sale en el header `set-auth-token` al iniciar sesión (ver `packages/auth/README.md`).
5. **Tenant**: `requireNutritionist` resuelve user → `nutritionists` y responde 401/403 JSON (sin `redirect`). A diferencia del panel, **no crea** el perfil al vuelo: un GET no debe tener efectos y el onboarding vive en la web.
6. **Rate limit** en memoria con ventana deslizante (`@granola/api/rate-limit`): middleware para `/api/v1/public/*` (60/min por IP y ruta) y helper `checkRateLimit(key, { limit, windowMs })` reutilizado al inicio de las server actions anónimas (10/min por IP; 30/min para ver horarios de reagendado).
7. **Contrato**: validación con `@hono/zod-validator` + zod v4; errores siempre `{ error: { code, message } }` con códigos estables (`validation_error`, `unauthorized`, `forbidden`, `not_found`, `rate_limited`, `internal_error`). Los 500 nunca filtran el mensaje interno.

## Para qué sí

- Endpoints que consumirá **Expo** (perfil del nutri, agenda, luego pacientes/planes) y clientes externos futuros.
- Lecturas públicas (perfil, slots) con caché HTTP y rate limit.
- Tipos compartidos con el cliente vía `AppType` + `hc` de `hono/client`.

## Para qué no (por ahora)

- **No** reescribir las server actions del panel: siguen siendo la vía de la web (formularios, `updateTag`, `redirect`).
- **No** mover webhooks (Stripe, Mercado Pago, WhatsApp), Inngest ni `/api/auth`: tienen su propio contrato con el proveedor.
- **No** exponer escrituras anónimas por la API hasta tener rate limit distribuido y captcha/turnstile.

## Consecuencias

- Duplicación pequeña y consciente: `packages/api/src/queries/public.ts` copia las queries y la lista blanca de columnas de `apps/web/src/lib/booking.ts` (ese archivo depende de `server-only`/`next/headers`). Siguiente paso: que apps/web consuma las queries del paquete y borrar la copia.
- **El rate limit es por instancia**: en Vercel cada lambda tiene su contador, así que el límite real es `limit × instancias`. Sirve contra abuso tonto, no como garantía. Antes de abrir escrituras públicas por la API, pasar el store a **Upstash Redis / Vercel KV** detrás de la misma interfaz (`RateLimiter`).
- Sin CORS por ahora: Expo nativo no lo necesita y la web llama mismo origen. Si algún día hay un cliente web en otro origen, agregar `hono/cors` con lista blanca.
- Tests en `packages/api` con auth y DB mockeadas (no hay helper de DB de test en el repo todavía).
