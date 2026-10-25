# ADR 0008 — Docker para desarrollo completo y portabilidad

**Fecha:** 2026-10-24 · **Estado:** aceptado (tarea F1.5)

## Decisión

Vercel sigue siendo el deploy principal. Docker permite desarrollar y explorar
Granola sin instalar Node ni pnpm en el host, y hospedar la misma aplicación
fuera de Vercel. No cambia auth, schema, migraciones ni server actions.

`apps/web/Dockerfile` usa Node 25 Alpine (igual que CI), el mismo pnpm que fija
`packageManager` instalado con npm (Node 25 ya no incluye corepack).
`pnpm fetch` cachea el lockfile antes de copiar fuentes; la instalación offline
filtra `@granola/web...`. Next compila con `output: "standalone"` y tracing desde
la raíz del monorepo. La imagen final incluye únicamente el runtime Node y
standalone/static/public; corre como usuario no root y comprueba `/`.
No se inyecta `DATABASE_URL` en el build: el cliente sigue siendo perezoso.
`NEXT_PUBLIC_APP_URL` es argumento de build porque Next integra variables públicas.

`docker-compose.yml` es un stack local con web en modo producción, Postgres 17,
proxy neon-http e Inngest dev. Un target separado incluye psql y pnpm para aplicar
SQL en orden, registrar cada archivo en `docker_migrations` dentro de su misma
transacción y ejecutar el seed existente. El job falla ante errores; web espera
su salida exitosa. La disponibilidad HTTP del proxy se espera antes del seed.
El ledger evita reaplicar SQL y el seed actualiza las filas demo de forma idempotente.
Si la base ya tiene tablas pero no ledger (migrada a mano), cada migración pendiente
se intenta aplicar; si falla solo con "already exists" se registra como aplicada
(baseline) y cualquier otro error tumba el job. El compose local original se conserva.

## Consecuencias

- Desarrollo sin cuentas cloud; WhatsApp conserva el dry run existente.
- El script genera un secreto aleatorio en `.env.docker` ignorado por Git.
- `docker-compose up` directo usa defaults explícitos de desarrollo; para usar el
  secreto generado se pasa `--env-file .env.docker` (lo hace el script).
- Proyecto Compose `granola-docker` y volumen `granola_docker_pg`, distintos del
  compose local (proyecto `granola`, volumen `granola_pg`). Puertos publicados solo
  en 127.0.0.1 y configurables (`POSTGRES_PORT`, `NEON_PROXY_PORT`, `WEB_PORT`,
  `INNGEST_PORT`); los defaults 5433/4444 coinciden con el compose local.
- Imágenes fijadas: `postgres:17.11-alpine`, `inngest/inngest:v1.49.0` y el proxy
  neon-http por digest (no publica tags de versión).
- CI construye el target `runner` en un job `docker` (sin push, check no requerido).
- Producción fuera de Vercel usa el target `runner`, orígenes públicos propios,
  secretos e integraciones reales y un proceso de migración administrado.
  El compose con demo e Inngest dev es para uso local.

## Qué NO cubre

No replica funciones específicas de Vercel: ISR/cache compartido entre réplicas,
CDN, invalidación distribuida, despliegues, dominios/TLS ni gestión de secretos.
No provisiona servicios externos (Meta, pagos, R2, correo o Inngest cloud), ni
resuelve backups, alta disponibilidad, escalado o la operación del hosting.
No introduce Google Calendar ni cambios clínicos de F2.

## Referencias

- [Next standalone y tracing de monorepo](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Variables de entorno del SDK de Inngest](https://www.inngest.com/docs/sdk/environment-variables)
