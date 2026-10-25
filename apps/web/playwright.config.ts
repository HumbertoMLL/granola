import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E del flujo de reserva contra `next dev` + granola_test.
 * Requiere `docker-compose -f docker-compose.local.yml up -d` (postgres + neon-proxy-test).
 * `pnpm e2e` (raíz) o `pnpm --filter @granola/web e2e`.
 */
const testEnv = parse(readFileSync(path.join(__dirname, ".env.test")));
// Aislamiento opcional por worktree; CI conserva granola_test por defecto.
if (process.env.GRANOLA_TEST_DATABASE_URL)
  testEnv.DATABASE_URL = process.env.GRANOLA_TEST_DATABASE_URL;
if (process.env.GRANOLA_TEST_PROXY)
  testEnv.NEON_LOCAL_PROXY = process.env.GRANOLA_TEST_PROXY;
// Los specs leen la DB con @granola/db/testing: necesitan las mismas variables que el server.
for (const [k, v] of Object.entries(testEnv)) process.env[k] = v;

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
testEnv.BETTER_AUTH_URL = baseURL;
testEnv.NEXT_PUBLIC_APP_URL = baseURL;
process.env.BETTER_AUTH_URL = baseURL;
process.env.NEXT_PUBLIC_APP_URL = baseURL;
const isCI = Boolean(process.env.CI);

/**
 * Llaves de servicios externos en blanco: `next dev` también carga `.env.local` si existe,
 * pero no pisa variables ya definidas. Así el E2E nunca habla con Stripe, MP, Meta ni Inngest cloud.
 */
const EXTERNAL_KEYS_BLANK = Object.fromEntries(
  [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "MP_ACCESS_TOKEN",
    "MP_WEBHOOK_SECRET",
    "WA_ACCESS_TOKEN",
    "WA_PHONE_NUMBER_ID",
    "WA_APP_SECRET",
    "INNGEST_EVENT_KEY",
    "INNGEST_SIGNING_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "RESEND_API_KEY",
  ].map((k) => [k, ""]),
);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  // next dev compila cada ruta la primera vez que se abre.
  timeout: 180_000,
  expect: { timeout: 30_000 },
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    locale: "es-MX",
    timezoneId: "America/Mexico_City",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    navigationTimeout: 90_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Base limpia + seed demo, luego el server de desarrollo en :3100.
    command: `pnpm exec tsx e2e/prepare.mts && pnpm exec next dev -p ${PORT}`,
    url: `${baseURL}/login`,
    // Nunca reutilizar: un `next dev` ya abierto en :3100 apuntaría a la base de desarrollo.
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...EXTERNAL_KEYS_BLANK, ...testEnv, NEXT_TELEMETRY_DISABLED: "1" },
  },
});
