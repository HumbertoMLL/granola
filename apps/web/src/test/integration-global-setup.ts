import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

/**
 * Corre una vez antes de todos los `*.int.test.ts`: crea `granola_test` si no
 * existe y aplica las migraciones SQL que falten. Corre en el proceso principal
 * de vitest, donde `test.env` aún no aplica, así que carga `.env.test` aquí.
 */
export default async function setup(): Promise<void> {
  const env = parse(
    readFileSync(fileURLToPath(new URL("../../.env.test", import.meta.url))),
  );
  if (process.env.GRANOLA_TEST_DATABASE_URL)
    env.DATABASE_URL = process.env.GRANOLA_TEST_DATABASE_URL;
  if (process.env.GRANOLA_TEST_PROXY)
    env.NEON_LOCAL_PROXY = process.env.GRANOLA_TEST_PROXY;
  for (const [k, v] of Object.entries(env)) process.env[k] = v;

  const { closeTestDb, ensureTestDb } = await import("@granola/db/testing");
  try {
    await ensureTestDb();
  } catch (err) {
    throw new Error(
      "No pude preparar la base de tests. ¿Está arriba el Postgres local?\n" +
        "  docker-compose -f docker-compose.local.yml up -d\n" +
        `Detalle: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    await closeTestDb();
  }
}
