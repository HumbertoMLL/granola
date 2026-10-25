# Granola vs Twelve-Factor

Guía de construcción adoptada el 25 oct 2026: https://github.com/twelve-factor/twelve-factor (edición en revisión, rama `next`; mismos 12 factores que la clásica, ejemplos modernizándose). Esta tabla se actualiza cuando cambie algo relevante.

| # | Factor | Estado | Evidencia / hueco |
|---|---|---|---|
| I | Codebase | ✅ | Un repo (`HumbertoMLL/granola`), monorepo pnpm; mismo código → Vercel, Docker local, worktrees por feature |
| II | Dependencies | ✅ | `pnpm-lock.yaml` + `--frozen-lockfile` en CI y Docker; corepack fija pnpm. ⚠️ menor: `npx neon@latest` / `npx vercel` en docs no están fijados |
| III | Config | ✅ | Todo por env vars (`.env.example` documenta cada una, sin valores); nada hardcodeado por entorno; `NEON_LOCAL_*` solo cambian la URL, no el código. Inherente a Next: `NEXT_PUBLIC_*` se hornea en build |
| IV | Backing services | ✅ | Postgres (Neon ↔ Docker) se cambia por URL; R2 es S3-compatible; WhatsApp/Stripe/MP/Inngest se desactivan quitando la var (dry run) sin tocar código |
| V | Build, release, run | ✅ | `Deploy` migra Neon tras CI verde de main, serializa `migrate-prod` y emite `granola/migrate-production`. Previews por PR + guard schema/migración en CI. Regla expand/contract en CLAUDE.md/AGENTS.md. Activación operativa: cargar secrets y exigir el check en Vercel (o dejar producción staged); [guía](../.github/workflows/README.md). Docker F1.5 se coordina por separado |
| VI | Processes | ⚠️ | Sesiones en DB, archivos en R2, jobs en Inngest: stateless. **Hueco:** el rate limiter de `@granola/api` guarda estado en memoria (`globalThis`) → mover a Upstash/KV antes de escrituras públicas por API |
| VII | Port binding | ✅ | Next escucha `PORT`; Hono montado dentro; nada depende de un servidor externo |
| VIII | Concurrency | ✅ | Serverless horizontal en Vercel; Inngest escala por evento; webhooks idempotentes. Limitado solo por el hueco de VI |
| IX | Disposability | ✅ | Funciones efímeras; `step.run` idempotentes con `cancelOn`; webhooks seguros ante replay; constraint anti-doble reserva en DB (no en memoria) |
| X | Dev/prod parity | ✅ | Mismo Postgres 17 y **mismo driver** (`neon-http` vía proxy local); misma migración SQL; CI usa los mismos contenedores. ⚠️ `drizzle-kit migrate` no corre contra el proxy local (se usa `psql`) |
| XI | Logs | ⚠️ | Solo `console.*` sin estructura; Sentry y PostHog aún no conectados. **Hueco:** logger JSON a stdout (pino) + log drain de Vercel; nunca escribir a archivo |
| XII | Admin processes | ✅ | `pnpm db:migrate`, `pnpm db:seed`, `scripts/*.ts` viven en el repo y corren con el mismo env que la app |

**Balance:** 10 ✅ · 2 ⚠️. Ningún factor en rojo.

## Acciones que salen de aquí (en orden)

1. **VI** — rate limiter a Upstash Redis/Vercel KV (`packages/api/src/rate-limit.ts`). Bloqueante antes de exponer POST públicos en `/api/v1`.
2. **V implementado** — cargar `DATABASE_URL`, `NEON_API_KEY`, `NEON_PROJECT_ID` en GitHub y configurar el Deployment Check de Vercel (o staged/manual). Validación en Neon real pendiente de keys; el YAML no cambia esa configuración externa. ADR [0012](adr/0012-migraciones-en-deploy.md).
3. **XI** — `packages/logger` con pino (JSON a stdout, `requestId`, sin PII de pacientes), Sentry para errores, drain de Vercel a donde se decida.
4. **X** — hacer que `drizzle-kit migrate` funcione en local (driver `pg` solo para drizzle-kit) para no tener dos caminos de migración.
5. **II** — fijar versiones de CLIs en docs y scripts (`npx neon@8`, `vercel@65`).

## Reglas que ya aplican a todo agente

- Nueva dependencia externa (API, cola, storage) → se adjunta por env var y debe poder faltar en dev sin romper el build.
- Nunca estado en memoria del proceso que importe entre requests.
- Logs a stdout, nunca a archivo; sin datos de salud en logs.
- Tareas administrativas = scripts en el repo, no comandos pegados en un chat.
