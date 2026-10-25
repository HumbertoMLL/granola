# CLAUDE.md — Granola

Clon de Avena para nutriólogos. Lee `PLAN.md` antes de tocar nada. Investigación en `docs/research/`.

## Repo

pnpm workspaces + Turborepo. Node 25, pnpm 11.

```
apps/web        Next.js 16 App Router (panel nutri + páginas públicas + API)
apps/mobile     Expo (futuro, no tocar aún)
packages/db     Drizzle + Neon Postgres. Schema en src/schema/*.ts, migraciones en migrations/
packages/auth   Better Auth (server + client)
packages/api    API v1 con Hono (/api/v1/*), montada en apps/web. Sin dependencia de Next (ADR 0007)
packages/core   Lógica pura sin IO: scheduling, smae, nutrition. 100% testeable con vitest
packages/whatsapp  Meta Cloud API client + plantillas + parser de webhooks
packages/payments  Stripe Connect + Mercado Pago
packages/jobs   Funciones Inngest
packages/ui     Design system Granola
packages/config eslint / tsconfig compartidos
```

## Guía de construcción

Seguimos Twelve-Factor (https://github.com/twelve-factor/twelve-factor). Estado y huecos por factor en `docs/twelve-factor.md`; toda decisión nueva se contrasta ahí.

## UX

Estructura elegida por pantalla y reglas de patrones de interfaz (checkbox vs radio vs chip, tab bar, listas, hojas) en `docs/ux-decisions.md`. Toda UI nueva las sigue.

## Reglas duras

1. **Datos de salud nunca llegan al cliente sin pasar por la API.** Toda query filtra por `nutritionist_id` de la sesión. No hay cliente de DB en el navegador.
2. **`packages/core` no importa nada con IO** (ni db, ni fetch, ni env). Recibe datos, devuelve datos. Tests obligatorios.
3. **Webhooks idempotentes**: Stripe, Mercado Pago y WhatsApp guardan `provider_ref` único antes de actuar.
4. **Todo lo que manda WhatsApp pasa por `packages/whatsapp`** y queda en `wa_messages`.
5. **Consentimiento LFPDPPP**: crear `patient` exige `consent_at` + `consent_ip`.
6. **Dinero en centavos (int), fechas en UTC (timestamptz), zona horaria del nutri guardada aparte.**
7. Sin `any`. Zod en toda frontera (forms, webhooks, API).
8. Commits en español, imperativo, cortos. Un PR por workstream.
9. **Todo feature nuevo llega con su test (integración si toca DB, E2E si toca el flujo de reserva). Nada se da por terminado con CI en rojo.**

## Comandos

```bash
pnpm dev            # todo (turbo)
pnpm dev --filter web
pnpm db:generate    # drizzle-kit generate
pnpm db:migrate
pnpm db:studio
pnpm test               # vitest unit (core, whatsapp, payments, web) — sin DB
pnpm test:integration   # apps/web/**/*.int.test.ts contra Postgres real (granola_test)
pnpm e2e                # Playwright: reservar → agenda → cancelar (levanta next dev en :3100)
pnpm lint && pnpm typecheck
```

## Tests

- `test:integration` y `e2e` necesitan `docker-compose -f docker-compose.local.yml up -d` (Postgres en 5433 + `neon-proxy-test` en 4445). Leen **solo** `apps/web/.env.test` (sin secretos, commiteado).
- Helpers en `@granola/db/testing`: `ensureTestDb`, `resetDb`, `seedNutritionist`, `seedService`, `seedPatient`, `seedAppointment`. Se niegan a tocar una base cuyo nombre no termine en `_test`.
- Integración: archivo `*.int.test.ts` junto al código, estilo BDD (`describe("Cuando…")` / `it("…")`). Solo se mockean fronteras externas (Inngest `@/lib/inngest-client`, Stripe/MP con fixtures, `@/lib/session`, `next/headers`, `next/navigation`, `next/cache`).
- CI: `.github/workflows/ci.yml` (jobs checks / integration / e2e). Ver `.github/workflows/README.md`.

## Env vars (apps/web/.env.local)

Ver `.env.example`. Nunca commitear `.env*` reales.

## Diseño

Design system propio en `packages/ui` (pendiente de definir en F0). **No** reciclar el dark theme de IA Sin Bullshit. Mobile-first: el nutri usa el panel desde el celular en consulta.

## Idioma

UI en español (MX). Código y nombres de tablas en inglés. Comentarios en español.
