import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export * from "./schema";
export { schema };

// Operadores re-exportados para que apps/web no dependa de drizzle-orm directo.
export {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";

export type Database = NeonHttpDatabase<typeof schema>;

let _db: Database | undefined;

/**
 * Cliente Drizzle sobre el driver HTTP de Neon. Se inicializa en el primer uso
 * para que `next build` y `tsc` pasen sin DATABASE_URL; en runtime falla con
 * mensaje claro si falta la variable.
 */
export function getDb(): Database {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL no está definida. Copia .env.example a apps/web/.env.local y pega la " +
        "cadena de conexión de Neon (ver packages/db/README.md).",
    );
  }
  _db = drizzle({ client: neon(localProxyUrl(url)), schema });
  return _db;
}

/**
 * Desarrollo sin Neon: con `NEON_LOCAL_PROXY` (p. ej. http://localhost:4444/sql) el
 * driver HTTP de Neon habla con el wsproxy de docker-compose.local.yml, que a su vez
 * se conecta al Postgres del compose en `NEON_LOCAL_PG_HOST` (postgres:5432).
 * En producción ambas variables no existen y la URL se usa tal cual.
 */
function localProxyUrl(url: string): string {
  const proxy = process.env.NEON_LOCAL_PROXY;
  if (!proxy) return url;
  neonConfig.fetchEndpoint = proxy;
  neonConfig.useSecureWebSocket = false;
  const pgHost = process.env.NEON_LOCAL_PG_HOST ?? "postgres:5432";
  const u = new URL(url);
  const [h, p] = pgHost.split(":");
  u.hostname = h ?? "postgres";
  u.port = p ?? "5432";
  return u.toString();
}

/** Acceso perezoso: `db.select()…` funciona igual que un cliente normal. */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real) as unknown;
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
  has(_target, prop) {
    return Reflect.has(getDb(), prop);
  },
});

/** SQLSTATE de Postgres que nos interesa distinguir. */
export const PG_EXCLUSION_VIOLATION = "23P01";

/**
 * true si el error (o alguno de sus `cause`) es una violación de exclusion
 * constraint (23P01), p. ej. `appointments_no_overlap` (cita encimada).
 * Drizzle envuelve el error del driver en `DrizzleQueryError` con `cause`.
 */
export function isExclusionViolation(err: unknown): boolean {
  let cur: unknown = err;
  for (let depth = 0; depth < 5 && cur && typeof cur === "object"; depth++) {
    if ((cur as { code?: unknown }).code === PG_EXCLUSION_VIOLATION) return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}
