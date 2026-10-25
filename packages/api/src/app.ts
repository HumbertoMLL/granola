import { Hono } from "hono";

import type { AppEnv } from "./env";
import { handleError, handleNotFound } from "./errors";
import { healthRoutes } from "./routes/health";
import { meRoutes } from "./routes/me";
import { publicRoutes } from "./routes/public";

/**
 * API v1 de Granola. Agnóstica de framework: hoy la monta Next en
 * `apps/web/src/app/api/v1/[[...route]]/route.ts`; mañana puede correr sola
 * (`apps/api` con `@hono/node-server`) sin tocar este archivo. Ver ADR 0007.
 *
 *   GET /api/v1/health
 *   GET /api/v1/public/:slug
 *   GET /api/v1/public/:slug/slots?serviceId&from&to
 *   GET /api/v1/me                      (sesión: cookie o Authorization: Bearer)
 *   GET /api/v1/me/appointments?from&to (sesión)
 */
export const app = new Hono<AppEnv>()
  .basePath("/api/v1")
  .route("/health", healthRoutes)
  .route("/public", publicRoutes)
  .route("/me", meRoutes);

app.onError(handleError);
app.notFound(handleNotFound);

/** Para el cliente RPC tipado (`hc<AppType>()` de `hono/client`) en Expo. */
export type AppType = typeof app;
