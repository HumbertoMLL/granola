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

## Reglas duras

1. **Datos de salud nunca llegan al cliente sin pasar por la API.** Toda query filtra por `nutritionist_id` de la sesión. No hay cliente de DB en el navegador.
2. **`packages/core` no importa nada con IO** (ni db, ni fetch, ni env). Recibe datos, devuelve datos. Tests obligatorios.
3. **Webhooks idempotentes**: Stripe, Mercado Pago y WhatsApp guardan `provider_ref` único antes de actuar.
4. **Todo lo que manda WhatsApp pasa por `packages/whatsapp`** y queda en `wa_messages`.
5. **Consentimiento LFPDPPP**: crear `patient` exige `consent_at` + `consent_ip`.
6. **Dinero en centavos (int), fechas en UTC (timestamptz), zona horaria del nutri guardada aparte.**
7. Sin `any`. Zod en toda frontera (forms, webhooks, API).
8. Commits en español, imperativo, cortos. Un PR por workstream.

## Comandos

```bash
pnpm dev            # todo (turbo)
pnpm dev --filter web
pnpm db:generate    # drizzle-kit generate
pnpm db:migrate
pnpm db:studio
pnpm test           # vitest en packages/core
pnpm lint && pnpm typecheck
```

## Env vars (apps/web/.env.local)

Ver `.env.example`. Nunca commitear `.env*` reales.

## Diseño

Design system propio en `packages/ui` (pendiente de definir en F0). **No** reciclar el dark theme de IA Sin Bullshit. Mobile-first: el nutri usa el panel desde el celular en consulta.

## Idioma

UI en español (MX). Código y nombres de tablas en inglés. Comentarios en español.
