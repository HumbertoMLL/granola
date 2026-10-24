# AGENTS.md — Granola (para Codex, Claude o cualquier agente)

Empieza por aquí, en este orden:

1. `docs/granola-overview.html` — resumen visual: PRD → RFC → ADR, estado actual. Ábrelo en el navegador.
2. `PLAN.md` — plan maestro: fases, prioridades, modelo de datos, flujo estrella.
3. `CLAUDE.md` — reglas duras del repo (aplican a todos los agentes, no solo Claude).
4. `docs/adr/` — decisiones tomadas y por qué. Si vas a cambiar una, escribe un ADR nuevo.
5. `packages/*/README.md` y `docs/whatsapp-plantillas.md` — detalle por paquete.

## Reglas resumidas

- Datos de salud **nunca** llegan al cliente sin pasar por la API; toda query filtra por `nutritionist_id` de la sesión.
- `packages/core` es lógica pura sin IO, con tests.
- Webhooks idempotentes (Stripe, Mercado Pago, WhatsApp).
- Dinero en centavos, fechas en UTC, zona horaria aparte.
- Sin `any`; zod en toda frontera.
- UI en español MX; código en inglés.

## Verificación antes de dar algo por terminado

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @granola/web exec next build
```

## Acceso

- Producción: https://granola-humbertomlls-projects.vercel.app (proyecto Vercel `granola`, team `humbertomlls-projects`, root `apps/web`). Sin `DATABASE_URL` en Vercel solo sirven landing/login/privacidad.
- Usuario demo tras `pnpm db:seed`: `karla@granola.demo` / `granola-demo-2026`, slug `karla`.
- Deploy: `npx vercel deploy --prod --yes --scope humbertomlls-projects` desde la raíz del repo.

## Dev

```bash
docker-compose -f docker-compose.local.yml up -d   # Postgres local + proxy HTTP Neon (puertos 5433 / 4444)
pnpm --filter @granola/web exec next dev -p 3100
```

`apps/web/.env.local` apunta a ese Postgres con `NEON_LOCAL_PROXY` (ver `packages/db/src/index.ts`). `drizzle-kit migrate` no funciona contra el proxy local: aplica las migraciones con `psql` (ver overview) y luego `pnpm db:seed`.

Sin `DATABASE_URL` en `apps/web/.env.local` las páginas con datos fallan en runtime (esperado); todo lo demás compila.

## Qué sigue (al 24 oct 2026)

- Probar F1 contra Neon real (migrar + seed + flujo completo). Google Calendar sync aún no existe.
- F1.5: todo el proyecto en Docker (`docker-compose up` = web + Postgres + proxy Neon + Inngest dev; `Dockerfile` standalone en apps/web). Ver `PLAN.md` sección 6.
- F2: pacientes, expediente, antropometría, notas IA. Ver `PLAN.md` sección 6.
