# AGENTS.md — Granola (para Codex, Claude o cualquier agente)

Empieza por aquí, en este orden:

1. `docs/granola-overview.html` — resumen visual: PRD → RFC → ADR, estado actual. Ábrelo en el navegador.
2. `PLAN.md` — plan maestro: fases, prioridades, modelo de datos, flujo estrella.
3. `CLAUDE.md` — reglas duras del repo (aplican a todos los agentes, no solo Claude).
4. `docs/adr/` — decisiones tomadas y por qué. Si vas a cambiar una, escribe un ADR nuevo.
5. `packages/*/README.md` y `docs/whatsapp-plantillas.md` — detalle por paquete.

## Trabajo en paralelo

Cada tarea va en su propio git worktree y rama (`scripts/wt.sh nueva <slug>`), se entrega por PR a `main` y CI decide. Guía y prompt-plantilla en `docs/worktrees.md`. Prompts listos por tarea pendiente en `docs/prompts-codex.md`.

## Guía de construcción

Seguimos Twelve-Factor (https://github.com/twelve-factor/twelve-factor). Estado y huecos por factor en `docs/twelve-factor.md`; toda decisión nueva se contrasta ahí.

## UX

Estructura elegida por pantalla y reglas de patrones de interfaz (checkbox vs radio vs chip, tab bar, listas, hojas) en `docs/ux-decisions.md`. Toda UI nueva las sigue.

## Reglas resumidas

- Datos de salud **nunca** llegan al cliente sin pasar por la API; toda query filtra por `nutritionist_id` de la sesión.
- `packages/core` es lógica pura sin IO, con tests.
- Webhooks idempotentes (Stripe, Mercado Pago, WhatsApp).
- Dinero en centavos, fechas en UTC, zona horaria aparte.
- Sin `any`; zod en toda frontera.
- UI en español MX; código en inglés.
- **Todo feature nuevo llega con su test (integración si toca DB, E2E si toca el flujo de reserva). Nada se da por terminado con CI en rojo.**

## Verificación antes de dar algo por terminado

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @granola/web exec next build
# si tocaste DB o flujos críticos (requiere docker-compose.local.yml arriba):
pnpm test:integration   # vitest *.int.test.ts contra granola_test
pnpm e2e                # Playwright: reservar → agenda de la nutri → cancelar
```

CI (`.github/workflows/ci.yml`) corre lo mismo en cada PR; `main` debe exigir los tres checks (ver `.github/workflows/README.md`).

## Acceso

- Producción: https://granola-humbertomlls-projects.vercel.app (proyecto Vercel `granola`, team `humbertomlls-projects`, root `apps/web`). Sin `DATABASE_URL` en Vercel solo sirven landing/login/privacidad.
- Usuario demo tras `pnpm db:seed`: `karla@granola.demo` / `granola-demo-2026`, slug `karla`.
- Deploy: `npx vercel deploy --prod --yes --scope humbertomlls-projects` desde la raíz del repo.

## Dev

```bash
docker-compose -f docker-compose.local.yml up -d   # Postgres local + proxy HTTP Neon (5433 / 4444; tests: 4445 → granola_test)
pnpm --filter @granola/web exec next dev -p 3100
```

`apps/web/.env.local` apunta a ese Postgres con `NEON_LOCAL_PROXY` (ver `packages/db/src/index.ts`). `drizzle-kit migrate` no funciona contra el proxy local: aplica las migraciones con `psql` (ver overview) y luego `pnpm db:seed`.

Sin `DATABASE_URL` en `apps/web/.env.local` las páginas con datos fallan en runtime (esperado); todo lo demás compila.

## API v1 (Hono)

`packages/api` (`@granola/api`) define la API HTTP versionada; Next la monta en `/api/v1/*` (`apps/web/src/app/api/v1/[[...route]]/route.ts`). Es para Expo y lecturas públicas; **no** reemplaza server actions, webhooks ni `/api/auth`. Auth por cookie o `Authorization: Bearer` (plugin `bearer()` de Better Auth). Errores `{ error: { code, message } }`. Ver [ADR 0007](docs/adr/0007-hono-api-v1.md) y `packages/api/README.md`.

Cómo probar (dev en el puerto 3100):

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

## Qué sigue (al 24 oct 2026)

- Probar F1 contra Neon real (migrar + seed + flujo completo). Google Calendar sync aún no existe.
- F2: pacientes, expediente, antropometría, notas IA. Ver `PLAN.md` sección 6.
- Hecho: F1.5 (Docker completo: `scripts/docker-up.sh`, ver sección Docker y ADR 0008). Pendiente decidir si el job `docker` de CI pasa a ser check requerido.

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

El compose usa su propio proyecto (`granola-docker`) y volumen (`granola_docker_pg`),
así que no toca los contenedores ni datos de `docker-compose.local.yml`. Los puertos
escuchan solo en 127.0.0.1 (`POSTGRES_PORT` 5433, `NEON_PROXY_PORT` 4444, `WEB_PORT`
3100, `INNGEST_PORT` 8288, en `.env.docker`); 5433/4444 coinciden con el compose
local: cámbialos en `.env.docker` si ambos van a estar arriba.
Para aislar una prueba: `COMPOSE_PROJECT_NAME=granola-docker-test` + otros puertos en `.env.docker`.
Si la base ya tiene tablas pero no `docker_migrations` (migrada a mano), el job
registra como aplicadas las migraciones cuyos objetos ya existen y aplica las nuevas.
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
