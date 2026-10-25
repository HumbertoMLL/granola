# Granola vs Twelve-Factor

Guía de construcción adoptada el 25 oct 2026: https://github.com/twelve-factor/twelve-factor (edición en revisión, rama `next`; mismos 12 factores que la clásica, ejemplos modernizándose). Esta tabla se actualiza cuando cambie algo relevante.

| # | Factor | Estado | Evidencia / hueco |
|---|---|---|---|
| I | Codebase | ✅ | Un repo (`HumbertoMLL/granola`), monorepo pnpm; mismo código → Vercel, Docker local, worktrees por feature |
| II | Dependencies | ✅ | `pnpm-lock.yaml` + `--frozen-lockfile` en CI y Docker; corepack fija pnpm. ⚠️ menor: `npx neon@latest` / `npx vercel` en docs no están fijados |
| III | Config | ✅ | Todo por env vars (`.env.example` documenta cada una, sin valores); nada hardcodeado por entorno; `NEON_LOCAL_*` solo cambian la URL, no el código. Inherente a Next: `NEXT_PUBLIC_*` se hornea en build |
| IV | Backing services | ✅ | Postgres (Neon ↔ Docker) se cambia por URL; R2 es S3-compatible; Email/WhatsApp/Stripe/MP/Inngest se desactivan quitando la var (dry run) sin tocar código |
| V | Build, release, run | ✅ | `Deploy` migra Neon tras CI verde de main, serializa `migrate-prod` y emite `granola/migrate-production`. Previews por PR + guard schema/migración en CI. Regla expand/contract en CLAUDE.md/AGENTS.md. Activación operativa: cargar secrets y exigir el check en Vercel (o dejar producción staged); [guía](../.github/workflows/README.md). Docker F1.5 se coordina por separado |
| VI | Processes | ✅ | `RateLimitStore` intercambiable en `packages/api/src/store.ts`: con ambas variables UPSTASH_REDIS_REST_* los contadores están en Redis vía REST (INCR + PEXPIRE NX, 2 comandos por intento). Memoria solo como fallback explícito, con warning único en producción. Fallos o timeout de 500 ms permiten continuar y se registran sin PII. Evidencia: tests de stores, timeout y headers en middleware; [ADR 0011](adr/0011-rate-limit-store.md). Operación distribuida requiere configurar las dos variables |
| VII | Port binding | ✅ | Next escucha `PORT`; Hono montado dentro; nada depende de un servidor externo |
| VIII | Concurrency | ✅ | Serverless horizontal en Vercel; Inngest escala por evento; webhooks idempotentes. Rate limit compartido por Redis cuando está configurado (VI) |
| IX | Disposability | ✅ | Funciones efímeras; `step.run` idempotentes con `cancelOn`; webhooks seguros ante replay; constraint anti-doble reserva en DB (no en memoria) |
| X | Dev/prod parity | ✅ | Mismo Postgres 17 y **mismo driver** (`neon-http` vía proxy local); misma migración SQL; CI usa los mismos contenedores. ⚠️ `drizzle-kit migrate` no corre contra el proxy local (se usa `psql`) |
| XI | Logs | ⚠️ | Email emite solo metadatos a stdout, sin PII ni tokens. Resto: `console.*` sin estructura; Sentry y PostHog aún no conectados. **Hueco:** logger JSON a stdout (pino) + log drain de Vercel; nunca escribir a archivo |
| XII | Admin processes | ✅ | `pnpm db:migrate`, `pnpm db:seed`, `scripts/*.ts` viven en el repo y corren con el mismo env que la app |

**Balance:** 11 ✅ · 1 ⚠️. Ningún factor en rojo.

## Acciones que salen de aquí (en orden)

1. **VI** — ✅ Store Upstash REST implementado; configurar ambas variables en producción. La memoria de dev/test y el fail-open por indisponibilidad son degradaciones explícitas, no garantías contra abuso durante una caída.
2. **V implementado** — cargar `DATABASE_URL`, `NEON_API_KEY`, `NEON_PROJECT_ID` en GitHub y configurar el Deployment Check de Vercel (o staged/manual). Validación en Neon real pendiente de keys; el YAML no cambia esa configuración externa. ADR [0012](adr/0012-migraciones-en-deploy.md).
3. **XI** — `packages/logger` con pino (JSON a stdout, `requestId`, sin PII de pacientes), Sentry para errores, drain de Vercel a donde se decida.
4. **X** — hacer que `drizzle-kit migrate` funcione en local (driver `pg` solo para drizzle-kit) para no tener dos caminos de migración.
5. **II** — fijar versiones de CLIs en docs y scripts (`npx neon@8`, `vercel@65`).

## Reglas que ya aplican a todo agente

- Nueva dependencia externa (API, cola, storage) → se adjunta por env var y debe poder faltar en dev sin romper el build.
- Nunca estado en memoria del proceso que importe entre requests.
- Logs a stdout, nunca a archivo; sin datos de salud en logs.
- Tareas administrativas = scripts en el repo, no comandos pegados en un chat.
