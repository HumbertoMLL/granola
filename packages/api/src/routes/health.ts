import { Hono } from "hono";

import type { AppEnv } from "../env";

/** Liveness: no toca la DB ni la sesión (sirve aunque falte DATABASE_URL). */
export const healthRoutes = new Hono<AppEnv>().get("/", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ ok: true, service: "granola-api", version: "v1", time: new Date().toISOString() });
});
