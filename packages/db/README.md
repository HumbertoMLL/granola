# @granola/db

Drizzle ORM + Neon Postgres (driver HTTP `@neondatabase/serverless`).

```
src/schema/*.ts   una tabla o dominio por archivo (auth, nutritionists, services, …)
src/index.ts      cliente `db` (perezoso) + re-export del schema y operadores
drizzle.config.ts lee DATABASE_URL de apps/web/.env.local
migrations/       SQL generado por drizzle-kit (se commitea)
```

## Convenciones

- PK `uuid` con `defaultRandom()`. Las tablas de Better Auth (`users`, `sessions`,
  `accounts`, `verifications`) también usan uuid (`generateId: "uuid"` en packages/auth).
- Fechas `timestamptz` en UTC; la zona horaria del nutri va en `nutritionists.timezone`.
- Dinero en centavos `integer` + `currency`.
- Enums de Postgres para status / modality / provider.
- Índice en cada FK y en `(nutritionist_id, starts_at)` de `appointments`.
- Columnas en `snake_case` en Postgres, `camelCase` en TypeScript.
- Importar `db` **solo en código de servidor**. Toda query filtra por `nutritionist_id`.

## Crear la base en Neon (una sola vez)

1. Entra a <https://console.neon.tech> y crea un proyecto `granola`
   (región **AWS us-east-1** o la más cercana; Postgres 17).
2. En el proyecto, crea un branch `dev` para desarrollo (el `main` queda para prod).
3. Copia la **connection string** (Dashboard → Connect → *Pooled connection* desactivado,
   el driver HTTP no necesita pooler). Se ve así:
   `postgresql://neondb_owner:xxx@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
4. Copia `.env.example` a `apps/web/.env.local` y pega la cadena en `DATABASE_URL`.
5. Desde la raíz del repo:

```bash
pnpm db:migrate     # aplica migrations/ a la DB
pnpm db:seed        # nutrióloga demo "Karla Demo" en /karla
pnpm db:studio      # explorador visual (opcional)
```

Para producción, pon el `DATABASE_URL` del branch `main` en Vercel y corre
`pnpm db:migrate` apuntando a ese env (o un paso de CI).

## Cambiar el schema

1. Edita o crea un archivo en `src/schema/` y expórtalo desde `src/schema/index.ts`.
2. `pnpm db:generate` → crea `migrations/00XX_*.sql` (no necesita DB).
3. Revisa el SQL y `pnpm db:migrate`.

Nunca edites un SQL ya aplicado; genera una migración nueva.

## Sin DATABASE_URL

`tsc`, `next build` y `drizzle-kit generate` funcionan sin la variable. El cliente
`db` se crea en el primer uso y, si falta, lanza
`DATABASE_URL no está definida…` en runtime.
