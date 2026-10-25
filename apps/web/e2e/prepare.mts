/**
 * Prepara granola_test para Playwright: crea/migra la base, la vacía y corre el
 * seed demo (karla@granola.demo, slug `karla`). Lo ejecuta el `webServer` de
 * playwright.config.ts antes de levantar `next dev`, con las variables de `.env.test`.
 *
 * Uso manual: `pnpm exec tsx e2e/prepare.mts` (desde apps/web, con .env.test cargado).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

// Si no vienen del webServer, las tomamos de .env.test (nunca de .env.local).
const testEnv = parse(readFileSync(path.resolve(here, "../.env.test")));
for (const [k, v] of Object.entries(testEnv)) process.env[k] ??= v;

const { closeTestDb, ensureTestDb, queryTestDb, resetDb } = await import("@granola/db/testing");

try {
  await ensureTestDb();
  await resetDb();

  // Mismo seed que `pnpm db:seed`; dotenv no pisa las variables que ya trae este proceso.
  execFileSync("pnpm", ["exec", "tsx", "scripts/seed.ts"], { cwd: repoRoot, stdio: "inherit", env: process.env });

  // El paciente solo puede cancelar con ≥ 2 h de antelación. Con 4 h de antelación mínima
  // para agendar, el "primer horario disponible" siempre queda cancelable durante el test.
  await queryTestDb("UPDATE nutritionists SET min_notice_min = 240 WHERE slug = 'karla'");
  console.log("✓ e2e: granola_test lista (seed demo + min_notice_min = 240)");
} finally {
  await closeTestDb();
}
