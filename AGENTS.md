# AGENTS.md — Granola (para Codex, Claude o cualquier agente)

Empieza por aquí, en este orden:

1. `docs/granola-overview.html` — resumen visual: PRD → RFC → ADR, estado actual. Ábrelo en el navegador.
2. `PLAN.md` — plan maestro: fases, prioridades, modelo de datos, flujo estrella.
3. `CLAUDE.md` — reglas duras del repo (aplican a todos los agentes, no solo Claude).
4. `docs/adr/` — decisiones tomadas y por qué. Si vas a cambiar una, escribe un ADR nuevo.
5. `packages/*/README.md` y `docs/whatsapp-plantillas.md` — detalle por paquete.

## Trabajo en paralelo

Cada tarea va en su propio git worktree y rama (`scripts/wt.sh nueva <slug>`), se entrega por PR a `main` y CI decide. Guía y prompt-plantilla en `docs/worktrees.md`.

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

## Docker

Sin Node ni pnpm en el host (solo Docker, docker-compose y openssl):

```bash
scripts/docker-up.sh
# http://localhost:3100 · karla@granola.demo / granola-demo-2026
# http://localhost:8288 · Inngest dev
```

El script crea `.env.docker`, genera `BETTER_AUTH_SECRET` y ejecuta
`docker-compose --env-file .env.docker up -d --build`. También se puede ejecutar
`docker-compose up --build` directamente con los valores locales de desarrollo;
para conservar el secreto generado usa siempre `--env-file .env.docker`.
El job `migrate` aplica los SQL en orden con un ledger transaccional y después
corre el seed idempotente. `web` espera a que termine; Inngest espera al healthcheck.
No se necesitan credenciales cloud para explorar la demo.

Se mantienen Postgres 17, el volumen `granola_pg` y los puertos 5433/4444 del
compose local. No ejecutes ambos stacks a la vez en los mismos puertos.
Para aislar una prueba: `COMPOSE_PROJECT_NAME=granola-docker-test POSTGRES_PORT=55433 NEON_PROXY_PORT=54444 scripts/docker-up.sh`.
El ledger se crea con la primera migración Docker sobre una base vacía; una base
anterior migrada manualmente requiere establecer su baseline antes de usar este job.
`docker-compose --env-file .env.docker down` conserva los datos; `down -v` los borra.

Imagen portable (contexto = raíz del monorepo):

```bash
docker build -f apps/web/Dockerfile --target runner --build-arg NEXT_PUBLIC_APP_URL=https://tu-dominio.example -t granola .
docker run --env-file /ruta/a/env-produccion -p 3100:3100 granola
```

En hosting configura `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` y las
integraciones reales. No uses el secreto de fallback, el seed demo ni Inngest dev
para producción. `NEXT_PUBLIC_APP_URL` se fija también durante el build.
La imagen final corre como UID 1001, solo incluye standalone/static/public y no
necesita `DATABASE_URL` al compilar. Ver `docs/adr/0008-docker.md` para los límites.
`docker-compose.local.yml` sigue disponible para trabajar con `next dev` en el host.
