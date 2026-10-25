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

Para producción, configura `DATABASE_URL` tanto en Vercel (runtime) como en GitHub Secrets
(migración, conexión directa sin `-pooler`). El workflow `Deploy` aplica las migraciones
automáticamente después de que **CI completo** termine en verde para un push a `main`;
no se ejecutan a mano como paso habitual de release.

## Flujo de release y previews

1. Cambia el schema con la regla **expand/contract** de CLAUDE.md: expansión compatible
   primero, código consumidor en otro release; retirada del uso y eliminación después.
   No combines renombrar/borrar columnas con el PR que deja de usarlas.
2. Ejecuta `pnpm db:generate`, revisa SQL y commitea SQL + snapshot + journal. Nunca
   edites una migración aplicada. No uses `drizzle-kit push` para este flujo.
3. `pnpm check:migrations` verifica el schema contra el último snapshot sin DB y exige
   una migración nueva si cambió `packages/db/src/schema` respecto a `origin/main`.
   Incluye cambios locales sin commit y archivos nuevos. Para otra base:
   `MIGRATIONS_BASE_REF=<sha-o-ref> pnpm check:migrations`.
4. Al abrir/actualizar/reabrir un PR del mismo repo, `Deploy` crea o reutiliza `pr-<número>`
   desde el branch Neon `production`, corre `pnpm --filter @granola/db migrate` y actualiza
   un comentario con el enlace privado al branch. Al cerrar el PR, lo borra. Los forks
   y Dependabot no reciben credenciales. Sin keys, el job lo indica en su resumen y omite
   el preview. El comentario **nunca publica DATABASE_URL**.
5. Tras merge y CI verde, el job `migrate` usa el **SHA exacto validado**, secret de producción
   y concurrency `migrate-prod` sin cancelación. Rechaza runs de commits superados antes
   de migrar. Una migración fallida deja el estado `granola/migrate-production` en rojo.
6. En Vercel, exige ese estado como **Deployment Check de producción** para bloquear la
   promoción hasta que la migración termine bien. Vercel sigue construyendo en cada push.
   Sin configurar ese check, la integración Git de Vercel es independiente y podría
   promover aunque GitHub falle. Configuración y alternativa staged/manual en
   [el README de workflows](../../.github/workflows/README.md).

`drizzle.config.ts` conserva prioridad de `process.env.DATABASE_URL` sobre `.env.local`
(dotenv no usa override). Los runners de GitHub no tienen `.env.local` ni proxy local.
Drizzle Kit detecta el driver instalado: en este repo usa `pg` (necesario para tests);
si no estuviera instalado, detectaría `@neondatabase/serverless` con WebSocket. No existe
un selector `driver: "neon-http"` en esta versión. Ambos caminos soportan Neon real;
este workflow conserva el CLI oficial, usa la conexión directa de Neon y **no** el
proxy HTTP local. La app sigue consultando con `neon-http`; este cambio no toca su driver.

Los previews por REST aplican explícitamente TTL de 7 días (igual a la política de
`neon.ts`, que no se evalúa al llamar la API REST). Un PR actualizado después de expirar
recrea el branch. Reutilizar no resetea los datos ni el historial ya migrado; para revisar
otra estrategia de migraciones, usa un branch nuevo. La copia incluye los datos del
padre: acceso solo para colaboradores autorizados del proyecto Neon. La URL de preview
no se inyecta automáticamente en Vercel; esta tarea valida las migraciones del PR.

Las migraciones ya aplicadas con Drizzle Kit se detectan en `drizzle.__drizzle_migrations`.
Una base montada antes con SQL manual necesita revisar su historial antes de habilitar
el workflow: no marques SQL como aplicado sin comprobar el schema. No se modifican ni
se inventan registros históricos desde este workflow.

## Cambiar el schema

1. Edita o crea un archivo en `src/schema/` y expórtalo desde `src/schema/index.ts`.
2. `pnpm db:generate` → crea `migrations/00XX_*.sql` (no necesita DB).
3. Revisa el SQL y `pnpm db:migrate`.

Nunca edites un SQL ya aplicado; genera una migración nueva.

## SQL manual en migraciones

drizzle-kit no modela algunas cosas de Postgres; se agregan **a mano al final** del SQL
generado (después de un `--> statement-breakpoint`) y se listan aquí para no perderlas:

| Migración | Objeto | Por qué |
|-----------|--------|---------|
| `0001_f1_gaps.sql` | `CREATE EXTENSION btree_gist` | Necesaria para combinar `=` sobre uuid con `&&` sobre rangos en un índice GiST. |
| `0001_f1_gaps.sql` | `appointments_no_overlap` (EXCLUDE) | `(nutritionist_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE status IN ('confirmed','pending_payment')`. Impide doble reserva aunque dos requests lleguen a la vez (neon-http no tiene transacciones interactivas). |

Notas:

- La violación llega como SQLSTATE **`23P01`** (`exclusion_violation`). `createBooking`
  (apps/web/src/app/[slug]/agendar/actions.ts) y el reagendado del paciente la traducen a
  "Ese horario se acaba de ocupar". Helper: `isExclusionViolation(err)` en `@granola/db`.
- Rango semiabierto `[)`: una cita que termina 10:00 no choca con otra que empieza 10:00.
  El `buffer_min` del nutri **no** lo cubre la constraint; lo aplica `packages/core/scheduling`.
- Si la base ya tuviera citas encimadas activas, el `ALTER TABLE … ADD CONSTRAINT` falla:
  cancélalas o corrígelas antes de `pnpm db:migrate`.
- **No uses `drizzle-kit push`** contra una base con estas migraciones: push compara con el
  schema TS y borraría la constraint. `generate` no la toca (trabaja sobre los snapshots).

## Sin DATABASE_URL

`tsc`, `next build` y `drizzle-kit generate` funcionan sin la variable. El cliente
`db` se crea en el primer uso y, si falta, lanza
`DATABASE_URL no está definida…` en runtime.
