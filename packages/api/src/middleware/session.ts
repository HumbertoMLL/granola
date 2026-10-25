import { auth } from "@granola/auth";
import { createMiddleware } from "hono/factory";

import type { SessionVariables } from "../env";
import { apiError } from "../errors";

/**
 * Exige sesión de Better Auth. Acepta las dos formas:
 *
 * - Cookie `better-auth.session_token` (panel web, mismo origen).
 * - `Authorization: Bearer <token>` (Expo). El plugin `bearer()` de
 *   `@granola/auth` convierte el header en cookie dentro de `getSession`, por eso
 *   aquí basta con pasar los headers crudos del request.
 *
 * Sin sesión válida → 401 `{ error: { code: "unauthorized" } }`.
 */
export const requireSession = createMiddleware<{ Variables: SessionVariables }>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!result) return apiError(c, 401, "unauthorized", "Inicia sesión para continuar");

  c.set("user", result.user);
  c.set("session", result.session);
  await next();
});
