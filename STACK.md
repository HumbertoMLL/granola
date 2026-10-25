# STACK.md — Granola

Inventario de servicios, dónde se configuran, env vars y costo esperado.
Actualizado: 24 oct 2026. Precios consultados ese día en las páginas oficiales (ver "Fuentes").
Decisiones: [ADR 0001 — Neon + Better Auth, no Supabase](docs/adr/0001-postgres-neon-no-supabase.md) · [ADR 0002 — WhatsApp Cloud API](docs/adr/0002-whatsapp-cloud-api-numero-granola.md) · [ADR 0003 — Design system](docs/adr/0003-design-system-calido-claro.md) · [PLAN.md §2](PLAN.md)

## Supuestos del costo a 10K

10,000 pacientes activos/mes, 1 nutrióloga por 50 pacientes (200 nutris con login; los pacientes no tienen login), 1 cita por paciente al mes, 2 MB de DB, 20 MB de archivos y 30 MB de egress por paciente (mismos supuestos que `docs/research/supabase-en-contra.txt:234`). USD, sin IVA.

## Servicios

| Servicio | Para qué | Dónde se configura | Env vars | Costo hoy | Costo a 10K | Estado |
|---|---|---|---|---|---|---|
| **Vercel** (proyecto `granola`) | Hosting de Next.js 16 (`apps/web`) | `.vercel/project.json`, `apps/web/next.config.ts` | `VERCEL_URL` (la pone Vercel) | $0 en Hobby (solo uso no comercial) | Pro $20/mes por seat, incluye $20 de crédito; excedente no modelado | Proyecto vinculado; producción pendiente. Hay que pasar a Pro antes de cobrar |
| **Neon Postgres** | Base de datos principal (Drizzle, driver `neon-http`) | `packages/db/src/index.ts`, `packages/db/drizzle.config.ts`, `packages/db/migrations/` | `DATABASE_URL` | $0 (aún no existe; local en Docker) | Launch: ~$88 (1 CU 24/7 a $0.106/CU-h = $77 + 20 GB × $0.35 + restore 20 GB × $0.20) | **Pendiente**: crear el proyecto |
| **Better Auth** (MIT, en nuestra DB) | Login de nutriólogas: email+password, magic link, Google | `packages/auth/src/index.ts`, `apps/web/src/app/api/auth/[...all]/route.ts`, `apps/web/src/proxy.ts`, `apps/web/src/lib/session.ts` | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | $0 | $0 (tablas `users/sessions/accounts/verifications` en Neon) | Activo: magic link y bienvenida con `@granola/email`; sin API key hacen dry run. Verificación de email no habilitada |
| **Google Calendar API v3** | Calendario primario: eventos y Meet, free/busy para slots | `packages/google-calendar/`, hooks de `packages/auth`, jobs y `/app/configuracion`; [ADR 0009](docs/adr/0009-google-calendar.md) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY` (32 bytes base64), `BETTER_AUTH_URL` | — (cuotas de Google) | No modelado | Implementado; requiere habilitar Calendar API y OAuth. Caché free/busy de 60 s **por instancia**, compartida por web y API v1 dentro del proceso; fallback a Granola si Google falla |
| **Hono** (API v1, `@granola/api`) | API HTTP propia para Expo y lecturas públicas con rate limit, montada en Next (mismo deploy) | `packages/api/`, `apps/web/src/app/api/v1/[[...route]]/route.ts`, [ADR 0007](docs/adr/0007-hono-api-v1.md) | — (usa las de Better Auth y Neon) | $0 (MIT) | $0. Rate limit distribuido con Upstash REST cuando están configuradas sus dos variables | Activo: `/health`, `/public/:slug`, `/public/:slug/slots`, `/me`, `/me/appointments` |
| **Upstash Redis** | Contadores compartidos de rate limit para API y acciones anónimas | `packages/api/src/store.ts`, [ADR 0011](docs/adr/0011-rate-limit-store.md) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Free: $0, **500K comandos/mes**, 250 MB y 10 GB de transferencia (verificado 24 oct 2026; la referencia anterior de 10K/día ya no coincide con pricing) | Según tráfico: 2 comandos por intento (INCR + PEXPIRE), hasta 250K intentos/mes en free si no se usan otros comandos; pago por uso $0.20/100K comandos | Implementado por REST vía fetch, sin SDK. Ventana fija; fail-open si falla o supera 500 ms. Configuración de credenciales pendiente |
| **Cloudflare R2** | Avatares y archivos (S3 API, URLs firmadas) | `apps/web/src/lib/storage.ts` | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | $0 (10 GB gratis) | ~$3 (200 GB × $0.015, egress $0) | Código listo; **no configurado** (sin vars el upload se deshabilita) |
| **Inngest** | Recordatorios WhatsApp (`sleepUntil`), expiración de pagos | `packages/jobs/src/`, `apps/web/src/app/api/inngest/route.ts`, `apps/web/src/lib/inngest-client.ts` | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | $0 (Free: 50K ejecuciones) | **$99** (Pro). ~16 ejecuciones por cita (run + cada `step`) × 10K citas = ~160K > 50K del Free | Código listo; cuenta cloud pendiente |
| **Meta WhatsApp Cloud API** | Confirmaciones, recordatorios, reseñas | `packages/whatsapp/src/env.ts`, `apps/web/src/app/api/webhooks/whatsapp/route.ts` | `WA_PHONE_NUMBER_ID`, `WA_BUSINESS_ACCOUNT_ID`, `WA_ACCESS_TOKEN`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET` (+ `WA_GRAPH_VERSION`, opcional, default `v21.0`, falta en `.env.example`) | $0 (sin token corre en "dry run") | **No verificado.** ADR 0002 estima USD 0.01–0.02 por mensaje utility en MX: ~4 mensajes × 10K = **$400–800**. Es la línea más cara del stack | Código listo; cuenta Meta Business y plantillas pendientes |
| **Stripe Connect** | Cobro con tarjeta a la cuenta de cada nutri (0% fee de Granola) | `packages/payments/src/stripe/`, `apps/web/src/app/api/webhooks/stripe/route.ts`, `apps/web/src/app/api/connect/stripe/*` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | $0 fijo | Comisión por transacción (no verificada aquí); Express puede cobrar por cuenta activa (no verificado) | Código listo; llaves pendientes |
| **Mercado Pago** | SPEI / OXXO al paciente | `packages/payments/src/mercadopago/`, `apps/web/src/app/api/webhooks/mercadopago/route.ts` | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | $0 fijo | Comisión por transacción (no verificada) | Código listo; llaves pendientes |
| **Resend** | Magic link, bienvenida, confirmación/nueva cita y cancelación | `packages/email`, `packages/auth/src/index.ts`, `packages/jobs/src/functions/` · [ADR 0010](docs/adr/0010-email-resend.md) | `RESEND_API_KEY`, `EMAIL_FROM` | Free: $0, 3,000 correos/mes, 100/día | Pro: $20/mes, 50,000 correos; ~20K para 10K citas si cada paciente tiene email, más auth/cancelaciones | Código listo; requiere dominio verificado y API key. Precios verificados el 24 oct 2026 en [Resend](https://resend.com/pricing) ([tabla oficial](https://resend.com/pricing.md)) |
| **PostHog** | Analítica de producto | — (no hay código) | `NEXT_PUBLIC_POSTHOG_KEY` | $0 | No verificado | **Pendiente** |
| **Sentry** | Errores | — (no hay código) | `SENTRY_DSN` | $0 | No verificado | **Pendiente** |
| **App URL** | Origen público para links de WA, Stripe, MP, OG | `packages/payments/src/env.ts` y otros (`NEXT_PUBLIC_APP_URL`, 4 usos) | `NEXT_PUBLIC_APP_URL` | — | — | Activo |
| **Docker local** | Postgres 17 + proxy HTTP compatible con `neon-http` para desarrollar sin Neon | `docker-compose.local.yml`, `packages/db/src/index.ts:55-66` | `DATABASE_URL=postgres://granola:granola@localhost:5433/granola`, `NEON_LOCAL_PROXY`, `NEON_LOCAL_PG_HOST` (las dos últimas **faltan en `.env.example`**) | $0 | $0 | Activo (solo DB). F1.5: `docker-compose up` con web + Inngest dev ([PLAN.md:175-177](PLAN.md)) |
| **GitHub Actions (CI)** | lint / typecheck / build / unit, integración (Postgres + proxy neon) y E2E (Playwright) | `.github/workflows/ci.yml` | — (usa `apps/web/.env.test`, sin secretos) | $0 | $0 | Workflow listo; falta proteger `main` con los checks requeridos (`.github/workflows/README.md`) |

## API v1 (Hono)

Capa HTTP propia en `packages/api` (`@granola/api`, sin dependencia de Next), montada en `apps/web/src/app/api/v1/[[...route]]/route.ts` con `handle()` de `@hono/vercel`. Decisión: [ADR 0007](docs/adr/0007-hono-api-v1.md).

| Ruta | Auth | Notas |
|---|---|---|
| `GET /api/v1/health` | — | No toca DB |
| `GET /api/v1/public/:slug` | — | Lista blanca de columnas; 60 req/min por IP |
| `GET /api/v1/public/:slug/slots?serviceId&from&to` | — | `@granola/core/scheduling`; rango recortado a 28 días; 60 req/min por IP |
| `GET /api/v1/me` | cookie o `Authorization: Bearer` | user + nutri de la sesión (sin tokens) |
| `GET /api/v1/me/appointments?from&to` | cookie o bearer | Máx. 93 días por request |

- Errores siempre `{ error: { code, message } }`. Validación con `@hono/zod-validator` + zod v4.
- Bearer: plugin `bearer()` de Better Auth (`packages/auth/src/index.ts`); el token llega en `set-auth-token` al iniciar sesión.
- Rate limit async (`@granola/api/rate-limit`), también aplicado a las server actions anónimas (agendar, cancelar/reagendar, reseña: 10/min por IP). Upstash REST con ambas variables; memoria sin ellas (warning único en producción). Ventanas fijas, fail-open a los 500 ms y headers de cuota en rutas limitadas. Ver ADR 0011.
- No reemplaza server actions del panel, webhooks, Inngest ni `/api/auth`.

Probar (con `pnpm --filter @granola/web exec next dev -p 3100` y la DB de Docker):

```bash
curl -s localhost:3100/api/v1/health
curl -s localhost:3100/api/v1/public/karla
curl -s "localhost:3100/api/v1/public/karla/slots?serviceId=<uuid>"

# Con la cookie del navegador (DevTools → Application → Cookies → better-auth.session_token)
curl -s localhost:3100/api/v1/me -H "Cookie: better-auth.session_token=<valor>"

# Con bearer (como lo hará Expo): el token sale en el header set-auth-token
TOKEN=$(curl -s -D - -o /dev/null localhost:3100/api/auth/sign-in/email \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3100' \
  -d '{"email":"karla@granola.demo","password":"granola-demo-2026"}' \
  | awk -F': ' 'tolower($1)=="set-auth-token"{print $2}' | tr -d '\r')
curl -s localhost:3100/api/v1/me -H "Authorization: Bearer $TOKEN"
curl -s "localhost:3100/api/v1/me/appointments?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z" -H "Authorization: Bearer $TOKEN"
```

## Total infra estimado (sin WhatsApp ni comisiones de pago)

| | 100 pacientes | 1,000 | 10,000 |
|---|---|---|---|
| Vercel Pro | $20 | $20 | $20+ |
| Neon Launch | ~$20 (0.25 CU 24/7) o $0 en Free | ~$40 (0.5 CU) | ~$88 (1 CU) |
| R2 | $0 | ~$0.15 | ~$3 |
| Inngest | $0 | $0 (~16K ejecuciones) | $99 |
| Better Auth | $0 | $0 | $0 |
| **Total** | **~$20–40** | **~$60** | **~$210** |

Comparativa con Supabase y la decisión: ver ADR 0001 y `docs/research/supabase-en-contra.txt` §5 (`:232-252`).

## Cosas que faltan en `.env.example`

`NEON_LOCAL_PROXY`, `NEON_LOCAL_PG_HOST`, `WA_GRAPH_VERSION` (se leen en `packages/db/src/index.ts:56,60` y `packages/whatsapp/src/env.ts:22`).

## Fuentes de precios (consultadas el 24 oct 2026)

- Neon: https://neon.com/pricing
- Supabase: https://supabase.com/pricing
- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/
- Inngest: https://www.inngest.com/pricing
- Vercel: https://vercel.com/pricing
- Better Auth: licencia MIT, sin costo (https://www.better-auth.com)
- WhatsApp: estimado de ADR 0002, no verificado contra la tabla de Meta.

- Resend (verificado el 24 oct 2026): [precios](https://resend.com/pricing), [tabla oficial](https://resend.com/pricing.md) y [cuotas gratis](https://resend.com/docs/knowledge-base/account-quotas-and-limits).
- Upstash Redis: https://upstash.com/pricing/redis (verificado 24 oct 2026: free 500K comandos/mes; no 10K/día).

## Archivos clínicos (F2)

`R2_PRIVATE_BUCKET` es un bucket privado separado de `R2_BUCKET` (avatares), sin
r2.dev ni dominio público. CORS permite PUT solo desde el origen de la app, con
Content-Type/Cache-Control. La subida usa PutObject firmado y finalización validada
en API para soportar 15 MB también en Vercel. `DOCUMENT_LINK_SECRET` firma accesos
privados (fallback BETTER_AUTH_SECRET). Sin R2 solo hay `.uploads` en desarrollo;
producción falla cerrado. Ver [documentos clínicos](docs/inbody.md).
