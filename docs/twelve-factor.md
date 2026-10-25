# Granola vs Twelve-Factor

Guía de construcción adoptada el 25 oct 2026: https://github.com/twelve-factor/twelve-factor (edición en revisión, rama `next`; mismos 12 factores que la clásica, ejemplos modernizándose). Esta tabla se actualiza cuando cambie algo relevante.

| # | Factor | Estado | Evidencia / hueco |
|---|---|---|---|
| I | Codebase | ✅ | Un repo (`HumbertoMLL/granola`), monorepo pnpm; mismo código → Vercel, Docker local, worktrees por feature |
| II | Dependencies | ✅ | `pnpm-lock.yaml` + `--frozen-lockfile` en CI y Docker; corepack fija pnpm. ⚠️ menor: `npx neon@latest` / `npx vercel` en docs no están fijados |
| III | Config | ✅ | Todo por env vars (`.env.example` documenta cada una, sin valores); nada hardcodeado por entorno; `NEON_LOCAL_*` solo cambian la URL, no el código. Inherente a Next: `NEXT_PUBLIC_*` se hornea en build |
| IV | Backing services | ✅ | Postgres (Neon ↔ Docker) se cambia por URL; R2 es S3-compatible; WhatsApp/Stripe/MP/Inngest se desactivan quitando la var (dry run) sin tocar código |
| V | Build, release, run | ⚠️ | Vercel hace releases inmutables con rollback. **Hueco:** las migraciones se corren a mano (`pnpm db:migrate`), no son parte del release → agregar paso de migración al deploy (job `migrate` del compose en F1.5 y step en CI/Vercel) |
| VI | Processes | ⚠️ | Sesiones en DB, archivos en R2, jobs en Inngest: stateless. **Hueco:** el rate limiter de `@granola/api` guarda estado en memoria (`globalThis`) → mover a Upstash/KV antes de escrituras públicas por API |
| VII | Port binding | ✅ | Next escucha `PORT`; Hono montado dentro; nada depende de un servidor externo |
| VIII | Concurrency | ✅ | Serverless horizontal en Vercel; Inngest escala por evento; webhooks idempotentes. Limitado solo por el hueco de VI |
| IX | Disposability | ✅ | Funciones efímeras; `step.run` idempotentes con `cancelOn`; webhooks seguros ante replay; constraint anti-doble reserva en DB (no en memoria) |
| X | Dev/prod parity | ✅ | Mismo Postgres 17 y **mismo driver** (`neon-http` vía proxy local); misma migración SQL; CI usa los mismos contenedores. ⚠️ `drizzle-kit migrate` no corre contra el proxy local (se usa `psql`) |
| XI | Logs | ⚠️ | Solo `console.*` sin estructura; Sentry y PostHog aún no conectados. **Hueco:** logger JSON a stdout (pino) + log drain de Vercel; nunca escribir a archivo |
| XII | Admin processes | ✅ | `pnpm db:migrate`, `pnpm db:seed`, `scripts/*.ts` viven en el repo y corren con el mismo env que la app |

**Balance:** 9 ✅ · 3 ⚠️. Ningún factor en rojo.

## Acciones que salen de aquí (en orden)

1. **VI** — rate limiter a Upstash Redis/Vercel KV (`packages/api/src/rate-limit.ts`). Bloqueante antes de exponer POST públicos en `/api/v1`.
2. **V** — migraciones como paso de release: job `migrate` en `docker-compose.yml` (F1.5, ya pedido a Codex) y step `pnpm db:migrate` en el workflow de deploy a producción (con `DATABASE_URL` de Neon como secret de GitHub).
3. **XI** — `packages/logger` con pino (JSON a stdout, `requestId`, sin PII de pacientes), Sentry para errores, drain de Vercel a donde se decida.
4. **X** — hacer que `drizzle-kit migrate` funcione en local (driver `pg` solo para drizzle-kit) para no tener dos caminos de migración.
5. **II** — fijar versiones de CLIs en docs y scripts (`npx neon@8`, `vercel@65`).

## Reglas que ya aplican a todo agente

- Nueva dependencia externa (API, cola, storage) → se adjunta por env var y debe poder faltar en dev sin romper el build.
- Nunca estado en memoria del proceso que importe entre requests.
- Logs a stdout, nunca a archivo; sin datos de salud en logs.
- Tareas administrativas = scripts en el repo, no comandos pegados en un chat.
