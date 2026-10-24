import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Solo lógica pura del app (p. ej. app/[slug]/agendar/outcome.ts). Nada de DOM ni DB.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
