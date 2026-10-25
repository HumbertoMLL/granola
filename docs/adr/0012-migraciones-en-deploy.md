# ADR 0012 — Migraciones en el release y branches Neon por PR

**Fecha:** 2026-10-24 · **Estado:** propuesto (requiere cargar secrets y configurar Vercel)

## Contexto

Las migraciones de Neon se aplicaban a mano. Una versión de código podía llegar a
producción con un schema incompatible; Twelve-Factor V exige separar build, release
y run. No se cambia el schema ni se agregan migraciones en este workstream.

## Decisión

- `Deploy` recibe `workflow_run` de **CI** completo. Solo migra pushes verdes de `main`
  del mismo repo. Checkout del SHA validado; rechazo de un HEAD superado antes de
  empezar; concurrency `migrate-prod` sin cancelar una migración en curso.
- `pnpm --filter @granola/db migrate` usa `secrets.DATABASE_URL` de Neon producción,
  conexión directa y sin proxy local. Se conserva el CLI y su autodetección de driver
  (`pg` ya está instalado para tests; el fallback es Neon serverless WebSocket).
  No se inventa una opción `neon-http` que Drizzle Kit no admite.
- El estado `granola/migrate-production` se escribe explícitamente sobre el SHA de
  CI (los check runs de `workflow_run` pueden apuntar al HEAD de la rama por defecto).
  El job falla ante error y solo autoriza promoción si termina bien.
- Vercel conserva builds por push y exige ese estado como Deployment Check. Si no se
  puede configurar, se deja producción staged sin alias automático y se promueve
  el mismo SHA manualmente tras migración verde. Sin ese ajuste externo, GitHub no
  puede impedir la promoción independiente de Vercel. No se agregan tokens Vercel.
- Regla **expand/contract**: expansión compatible en un release previo; código que
  la utiliza después; backfill, retirada del uso y contract separados. Nunca borrar
  o renombrar en el mismo PR que deja de usar el campo. Se preserva rollback del código.
- En PRs internos se crea/reutiliza `pr-N` desde production con compute y TTL de 7 días,
  se migra y se comenta solo la URL autenticada de la consola Neon. Al cerrar se borra.
  La API REST evita depender de una instalación o sesión local del CLI Neon. `neon.ts`
  no se modifica; su TTL se reproduce explícitamente porque REST no evalúa esa política.
- Sin keys de preview se omite con mensaje; producción sin DATABASE_URL falla.
  Condiciones de secrets vía env/output, ya que `secrets` directo en `if` no es válido.
  Se excluyen forks/Dependabot y no se usa `pull_request_target`.
- `pnpm check:migrations` compara el árbol de trabajo (incluye staged, unstaged y nuevos)
  con una base Git, exige SQL + journal nuevos, protege historial previo y contrasta
  el schema serializado por Drizzle con el último snapshot; luego `drizzle-kit check`.
  No genera ni aplica SQL. El API de snapshots está sujeto a la versión fijada en lockfile.

## Consecuencias y límites

Las migraciones pasan a ser una fase reproducible del release. No se hace rollback
SQL automático ni se intenta revertir una operación DDL a ciegas: corregir hacia
adelante, validar en preview y reejecutar. Expand/contract permite seguir sirviendo
la versión anterior si una migración falla. Si un commit nuevo reemplaza uno en espera,
el último contiene todas las migraciones acumuladas.

Los previews copian filas de producción; solo colaboradores autorizados pueden usar
el repo/proyecto y la URL con contraseña nunca sale del runner. El preview valida
migraciones, no integra automáticamente esa DB con el deployment web de Vercel.
Un branch reutilizado conserva datos e historial; para una estrategia distinta se
necesita un branch nuevo. El TTL limita huérfanos si un cierre falla o nunca se entrega.

La activación necesita tres secrets y un ajuste de Vercel, detallados en
[el README de workflows](../../.github/workflows/README.md). Sin ellos, las pruebas HTTP
son simuladas y no se afirma validación contra Neon real. No se tocan schema,
migraciones, runtime de la app, ni el despliegue Docker de otro workstream.
