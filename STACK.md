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
| **Better Auth** (MIT, en nuestra DB) | Login de nutriólogas: email+password, magic link, Google | `packages/auth/src/index.ts`, `apps/web/src/app/api/auth/[...all]/route.ts`, `apps/web/src/proxy.ts`, `apps/web/src/lib/session.ts` | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | $0 | $0 (tablas `users/sessions/accounts/verifications` en Neon) | Activo en código. Magic link solo imprime en consola (`packages/auth/src/index.ts:31-32`) hasta conectar Resend |
| **Cloudflare R2** | Avatares y archivos (S3 API, URLs firmadas) | `apps/web/src/lib/storage.ts` | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | $0 (10 GB gratis) | ~$3 (200 GB × $0.015, egress $0) | Código listo; **no configurado** (sin vars el upload se deshabilita) |
| **Inngest** | Recordatorios WhatsApp (`sleepUntil`), expiración de pagos | `packages/jobs/src/`, `apps/web/src/app/api/inngest/route.ts`, `apps/web/src/lib/inngest-client.ts` | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | $0 (Free: 50K ejecuciones) | **$99** (Pro). ~16 ejecuciones por cita (run + cada `step`) × 10K citas = ~160K > 50K del Free | Código listo; cuenta cloud pendiente |
| **Meta WhatsApp Cloud API** | Confirmaciones, recordatorios, reseñas | `packages/whatsapp/src/env.ts`, `apps/web/src/app/api/webhooks/whatsapp/route.ts` | `WA_PHONE_NUMBER_ID`, `WA_BUSINESS_ACCOUNT_ID`, `WA_ACCESS_TOKEN`, `WA_VERIFY_TOKEN`, `WA_APP_SECRET` (+ `WA_GRAPH_VERSION`, opcional, default `v21.0`, falta en `.env.example`) | $0 (sin token corre en "dry run") | **No verificado.** ADR 0002 estima USD 0.01–0.02 por mensaje utility en MX: ~4 mensajes × 10K = **$400–800**. Es la línea más cara del stack | Código listo; cuenta Meta Business y plantillas pendientes |
| **Stripe Connect** | Cobro con tarjeta a la cuenta de cada nutri (0% fee de Granola) | `packages/payments/src/stripe/`, `apps/web/src/app/api/webhooks/stripe/route.ts`, `apps/web/src/app/api/connect/stripe/*` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | $0 fijo | Comisión por transacción (no verificada aquí); Express puede cobrar por cuenta activa (no verificado) | Código listo; llaves pendientes |
| **Mercado Pago** | SPEI / OXXO al paciente | `packages/payments/src/mercadopago/`, `apps/web/src/app/api/webhooks/mercadopago/route.ts` | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | $0 fijo | Comisión por transacción (no verificada) | Código listo; llaves pendientes |
| **Resend** | Email transaccional (magic link) | — (no hay código todavía) | `RESEND_API_KEY` | $0 | No verificado | **Pendiente** |
| **PostHog** | Analítica de producto | — (no hay código) | `NEXT_PUBLIC_POSTHOG_KEY` | $0 | No verificado | **Pendiente** |
| **Sentry** | Errores | — (no hay código) | `SENTRY_DSN` | $0 | No verificado | **Pendiente** |
| **App URL** | Origen público para links de WA, Stripe, MP, OG | `packages/payments/src/env.ts` y otros (`NEXT_PUBLIC_APP_URL`, 4 usos) | `NEXT_PUBLIC_APP_URL` | — | — | Activo |
| **Docker local** | Postgres 17 + proxy HTTP compatible con `neon-http` para desarrollar sin Neon | `docker-compose.local.yml`, `packages/db/src/index.ts:55-66` | `DATABASE_URL=postgres://granola:granola@localhost:5433/granola`, `NEON_LOCAL_PROXY`, `NEON_LOCAL_PG_HOST` (las dos últimas **faltan en `.env.example`**) | $0 | $0 | Activo (solo DB). F1.5: `docker-compose up` con web + Inngest dev ([PLAN.md:175-177](PLAN.md)) |
| **GitHub Actions (CI)** | lint / typecheck / test | `.github/` (vacío) | — | $0 | $0 | **Pendiente** |

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
