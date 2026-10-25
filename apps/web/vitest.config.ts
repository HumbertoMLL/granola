import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

/** Solo `.env.test` (nunca `.env.local`): los tests no deben ver llaves reales. */
const testEnv = parse(readFileSync(fileURLToPath(new URL("./.env.test", import.meta.url))));

/**
 * Dos proyectos:
 * - `unit`: lógica pura del app (p. ej. app/[slug]/agendar/outcome.ts). Nada de DOM ni DB.
 *   `pnpm test` (lo que corre el job de CI sin servicios).
 * - `integration`: `*.int.test.ts` contra Postgres real (granola_test vía neon-proxy-test).
 *   Solo se mockean fronteras externas (Inngest, Stripe, next/headers, next/navigation).
 *   `pnpm test:integration`. Requiere `docker-compose -f docker-compose.local.yml up -d`.
 */
export default defineConfig({
  resolve: {
    alias: { "@": src },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.int.test.ts"],
        },
      },
      {
        extends: true,
        resolve: {
          // `server-only` lanza fuera de un bundle de React Server Components.
          alias: { "server-only": fileURLToPath(new URL("./src/test/empty-module.ts", import.meta.url)) },
        },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          env: testEnv,
          globalSetup: ["./src/test/integration-global-setup.ts"],
          setupFiles: ["./src/test/integration-setup.ts"],
          // Una sola base compartida: los archivos corren en serie y cada test parte de cero.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
