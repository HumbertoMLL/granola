/**
 * Utilidades para tests de integración y E2E contra un Postgres real.
 *
 * - `ensureTestDb()` crea la base (si no existe) y aplica `migrations/*.sql` que falten.
 * - `resetDb()` deja todas las tablas públicas vacías (TRUNCATE … CASCADE).
 * - `seedNutritionist` / `seedService` / `seedPatient` / `seedAppointment`: factories
 *   con datos falsos (sin llaves reales) que escriben con el mismo cliente `db`
 *   (neon-http → proxy local) que usa la app.
 *
 * El DDL y el TRUNCATE van por `pg` directo (más rápido y sin pasar por el proxy).
 * Por seguridad todo se niega a correr si el nombre de la base no termina en `_test`.
 *
 * Variables: `DATABASE_URL` (postgres://…/granola_test), `NEON_LOCAL_PROXY`,
 * `NEON_LOCAL_PG_HOST` (ver apps/web/.env.test). Uso: `import … from "@granola/db/testing"`.
 */
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { db, eq } from "./index";
import {
  appointments,
  availabilityRules,
  nutritionists,
  patients,
  services,
  users,
  type NutritionistTheme,
} from "./schema";

const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");
const MIGRATIONS_TABLE = "__test_migrations";

/* ------------------------------------------------------------------ */
/* Conexión directa (DDL, TRUNCATE)                                    */
/* ------------------------------------------------------------------ */

function testDatabaseUrl(): URL {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("[db/testing] DATABASE_URL no está definida (¿cargaste apps/web/.env.test?)");
  const url = new URL(raw);
  const name = url.pathname.replace(/^\//, "");
  if (!name.endsWith("_test")) {
    throw new Error(`[db/testing] Me niego a tocar la base "${name}": el nombre debe terminar en _test.`);
  }
  return url;
}

let _pool: pg.Pool | undefined;

function pool(): pg.Pool {
  _pool ??= new pg.Pool({ connectionString: testDatabaseUrl().toString(), max: 2 });
  return _pool;
}

/** Cierra la conexión directa. Llamar en `afterAll` / teardown para que el proceso termine. */
export async function closeTestDb(): Promise<void> {
  await _pool?.end();
  _pool = undefined;
}

/** SQL crudo contra la base de test (para asserts que no valen un query de Drizzle). */
export async function queryTestDb<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const res = await pool().query<T>(text, values);
  return res.rows;
}

/**
 * Crea la base si no existe (conectando a `postgres`) y aplica, en orden, las
 * migraciones SQL que aún no estén registradas en `__test_migrations`.
 * Idempotente: se puede llamar en cada corrida.
 */
export async function ensureTestDb(): Promise<void> {
  const url = testDatabaseUrl();
  const name = url.pathname.replace(/^\//, "");

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
  } finally {
    await admin.end();
  }

  const client = await pool().connect();
  try {
    // El proxy local (local-neon-http-proxy) crea esta tabla en su start.sh, pero solo si la
    // base ya existía cuando arrancó el contenedor. La creamos aquí para no depender del orden.
    await client.query(
      `CREATE SCHEMA IF NOT EXISTS neon_control_plane;
       CREATE TABLE IF NOT EXISTS neon_control_plane.endpoints (
         endpoint_id varchar(255) PRIMARY KEY,
         allowed_ips varchar(255)
       )`,
    );
    await client.query(
      `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    const applied = new Set(
      (await client.query<{ name: string }>(`SELECT name FROM ${MIGRATIONS_TABLE}`)).rows.map((r) => r.name),
    );
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (applied.has(file)) continue;
      const sqlText = readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        // drizzle-kit separa sentencias con `--> statement-breakpoint`; para pg es solo un comentario.
        await client.query(sqlText);
        await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1)`, [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`[db/testing] falló la migración ${file}: ${err instanceof Error ? err.message : err}`);
      }
    }
  } finally {
    client.release();
  }
}

/** Vacía todas las tablas públicas (menos el registro de migraciones). */
export async function resetDb(): Promise<void> {
  const rows = await queryTestDb<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> $1",
    [MIGRATIONS_TABLE],
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"public"."${r.tablename.replace(/"/g, '""')}"`).join(", ");
  await queryTestDb(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}

/* ------------------------------------------------------------------ */
/* Factories                                                           */
/* ------------------------------------------------------------------ */

type NutritionistRow = typeof nutritionists.$inferSelect;
type UserRow = typeof users.$inferSelect;
type ServiceRow = typeof services.$inferSelect;
type PatientRow = typeof patients.$inferSelect;
type AppointmentRow = typeof appointments.$inferSelect;

function uniq(): string {
  return randomBytes(4).toString("hex");
}

/** Token opaco con el mismo formato que `generateCancelToken()` de apps/web. */
export function fakeCancelToken(): string {
  return randomBytes(24).toString("base64url");
}

export type SeedNutritionistInput = Partial<
  Pick<
    NutritionistRow,
    | "slug"
    | "displayName"
    | "timezone"
    | "phoneWa"
    | "bio"
    | "cedula"
    | "stripeAccountId"
    | "googleRefreshTokenEnc"
    | "mpUserId"
    | "bufferMin"
    | "minNoticeMin"
    | "slotStepMin"
  >
> & {
  email?: string;
  theme?: NutritionistTheme;
  /**
   * Ventanas semanales (hora local). Default: todos los días 08:00–20:00, para que
   * siempre haya slots sin importar qué día corre el test. `[]` = sin disponibilidad.
   */
  availability?: { weekday: number; startTime: string; endTime: string }[];
};

const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "08:00", endTime: "20:00" }));

/** Usuario (Better Auth) + perfil de nutrióloga + disponibilidad. */
export async function seedNutritionist(
  input: SeedNutritionistInput = {},
): Promise<{ user: UserRow; nutritionist: NutritionistRow }> {
  const id = uniq();
  const { email, availability = ALL_WEEK, theme, ...profile } = input;
  const [user] = await db
    .insert(users)
    .values({ name: profile.displayName ?? `Nutri ${id}`, email: email ?? `nutri-${id}@granola.test`, emailVerified: true })
    .returning();
  if (!user) throw new Error("[db/testing] no se pudo crear el usuario");

  const [nutritionist] = await db
    .insert(nutritionists)
    .values({
      userId: user.id,
      slug: `nutri-${id}`,
      displayName: `Nutri ${id}`,
      timezone: "America/Mexico_City",
      onboardingStep: 99,
      theme: theme ?? {},
      ...profile,
    })
    .returning();
  if (!nutritionist) throw new Error("[db/testing] no se pudo crear la nutrióloga");

  if (availability.length > 0) {
    await db
      .insert(availabilityRules)
      .values(availability.map((r) => ({ ...r, nutritionistId: nutritionist.id })));
  }
  return { user, nutritionist };
}

export type SeedServiceInput = { nutritionistId: string } & Partial<
  Pick<
    ServiceRow,
    "name" | "description" | "durationMin" | "priceCents" | "modality" | "location" | "paymentMode" | "isActive" | "sortOrder"
  >
>;

export async function seedService(input: SeedServiceInput): Promise<ServiceRow> {
  const [row] = await db
    .insert(services)
    .values({
      name: "Seguimiento",
      durationMin: 30,
      priceCents: 50000,
      currency: "MXN",
      modality: "online",
      paymentMode: "optional",
      ...input,
    })
    .returning();
  if (!row) throw new Error("[db/testing] no se pudo crear el servicio");
  return row;
}

export type SeedPatientInput = { nutritionistId: string } & Partial<
  Pick<PatientRow, "name" | "phoneWa" | "email" | "consentAt" | "consentIp" | "source">
>;

/** Paciente con consentimiento LFPDPPP (consent_at + consent_ip), como exige la regla dura #5. */
export async function seedPatient(input: SeedPatientInput): Promise<PatientRow> {
  const n = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const [row] = await db
    .insert(patients)
    .values({
      name: "Paciente Prueba",
      phoneWa: `+5255${n}`,
      consentAt: new Date(),
      consentIp: "203.0.113.10",
      source: "manual",
      ...input,
    })
    .returning();
  if (!row) throw new Error("[db/testing] no se pudo crear el paciente");
  return row;
}

export type SeedAppointmentInput = {
  nutritionistId: string;
  /** Si falta, se crea un paciente nuevo. */
  patientId?: string;
  /** Si falta, se crea un servicio "Seguimiento" (30 min). */
  serviceId?: string;
  /** Default: dentro de 3 días a la hora en punto (UTC). */
  startsAt?: Date;
  /** Default: startsAt + duración del servicio (o 30 min). */
  endsAt?: Date;
} & Partial<Pick<AppointmentRow, "status" | "modality" | "cancelToken" | "notes" | "patientTimezone">>;

export async function seedAppointment(input: SeedAppointmentInput): Promise<AppointmentRow> {
  const { nutritionistId } = input;
  const patientId = input.patientId ?? (await seedPatient({ nutritionistId })).id;

  let durationMin = 30;
  let serviceId = input.serviceId;
  if (serviceId) {
    const svc = await db.query.services.findFirst({ where: eq(services.id, serviceId), columns: { durationMin: true } });
    durationMin = svc?.durationMin ?? durationMin;
  } else {
    serviceId = (await seedService({ nutritionistId })).id;
  }

  const startsAt = input.startsAt ?? inDaysAtHourUtc(3, 16);
  const endsAt = input.endsAt ?? new Date(startsAt.getTime() + durationMin * 60_000);
  const [row] = await db
    .insert(appointments)
    .values({
      nutritionistId,
      patientId,
      serviceId,
      startsAt,
      endsAt,
      status: input.status ?? "confirmed",
      modality: input.modality ?? "online",
      cancelToken: input.cancelToken ?? fakeCancelToken(),
      notes: input.notes ?? null,
      patientTimezone: input.patientTimezone ?? null,
    })
    .returning();
  if (!row) throw new Error("[db/testing] no se pudo crear la cita");
  return row;
}

/** Fecha UTC `days` días adelante a las `hour`:00 UTC (16:00 UTC = 10:00 en CDMX). */
export function inDaysAtHourUtc(days: number, hour: number): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days, hour, 0, 0, 0));
}

/** Cita más reciente de un paciente por su WhatsApp E.164 (para E2E: sacar el cancel token). */
export async function findLatestAppointmentByPatientPhone(
  phoneE164: string,
): Promise<{ id: string; status: string; cancelToken: string } | null> {
  const rows = await queryTestDb<{ id: string; status: string; cancel_token: string }>(
    `SELECT a.id, a.status, a.cancel_token
       FROM appointments a JOIN patients p ON p.id = a.patient_id
      WHERE p.phone_wa = $1
      ORDER BY a.created_at DESC
      LIMIT 1`,
    [phoneE164],
  );
  const r = rows[0];
  return r ? { id: r.id, status: r.status, cancelToken: r.cancel_token } : null;
}
