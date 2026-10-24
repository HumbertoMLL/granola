import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Las env vars viven en apps/web/.env.local (ver .env.example en la raíz).
const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../apps/web/.env.local"), quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema",
  out: "./migrations",
  dbCredentials: {
    // `generate` no necesita DB; `migrate`/`studio` sí (fallan con mensaje claro si falta).
    url: process.env.DATABASE_URL ?? "postgresql://missing:missing@localhost:5432/missing",
  },
  strict: true,
  verbose: true,
});
