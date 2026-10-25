#!/bin/sh
set -eu
# Un ledger independiente evita volver a aplicar ALTER TABLE no idempotentes.
# Cada archivo y su marca se confirman en la misma transacción.

q() { psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "$1"; }

# Base previa migrada a mano (psql / drizzle-kit): tiene tablas pero no ledger.
# En ese modo, una migración que falla solo porque sus objetos ya existen se
# registra como aplicada (baseline) en vez de tumbar el job; las nuevas se aplican.
legacy=0
if [ "$(q "SELECT to_regclass('public.docker_migrations') IS NULL")" = t ] &&
  [ "$(q "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")" != 0 ]; then
  legacy=1
  echo "[migrate] base con tablas y sin docker_migrations: registro como aplicadas las migraciones que ya existen"
fi

q "CREATE TABLE IF NOT EXISTS public.docker_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)" >/dev/null

for migration in packages/db/migrations/*.sql; do
  name=$(basename "$migration")
  if [ "$(q "SELECT count(*) FROM public.docker_migrations WHERE name = '$name'")" != 0 ]; then
    continue
  fi
  # -1: archivo + marca en una sola transacción. Con -f (no un pipe) un archivo ilegible
  # hace fallar a psql en vez de registrar como aplicada una migración vacía.
  if output=$(psql "$DATABASE_URL" -q -1 -v ON_ERROR_STOP=1 -f "$migration" \
    -c "INSERT INTO public.docker_migrations (name) VALUES ('$name')" 2>&1); then
    echo "[migrate] aplicada $name"
  elif [ "$legacy" = 1 ] && printf '%s' "$output" | grep -q 'already exists'; then
    # El BEGIN se revirtió al salir psql: nada quedó a medias.
    q "INSERT INTO public.docker_migrations (name) VALUES ('$name')" >/dev/null
    echo "[migrate] $name ya estaba aplicada: registrada en docker_migrations"
  else
    printf '%s\n' "$output" >&2
    echo "[migrate] falló $name" >&2
    exit 1
  fi
done

# Compose conoce el arranque del contenedor, no la disponibilidad HTTP del proxy.
node --input-type=module <<'JS'
for (let attempt = 0; ; attempt++) {
  try {
    await fetch(process.env.NEON_LOCAL_PROXY, { signal: AbortSignal.timeout(2000) });
    break;
  } catch (error) {
    if (attempt >= 29) throw error;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
JS
pnpm db:seed
