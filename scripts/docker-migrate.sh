#!/bin/sh
set -eu
# Un ledger independiente evita volver a aplicar ALTER TABLE no idempotentes.
# Cada archivo y su marca se confirman en la misma transacción.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.docker_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL
for migration in packages/db/migrations/*.sql; do
  name=$(basename "$migration")
  applied=$(psql "$DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM public.docker_migrations WHERE name = '$name'")
  if [ "$applied" = 0 ]; then
    { printf 'BEGIN;\n'; cat "$migration"; printf "\nINSERT INTO public.docker_migrations (name) VALUES ('%s');\nCOMMIT;\n" "$name"; } | psql "$DATABASE_URL" -v ON_ERROR_STOP=1
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
