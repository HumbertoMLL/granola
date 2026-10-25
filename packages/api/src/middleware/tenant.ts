import { createMiddleware } from "hono/factory";

import type { SessionVariables, TenantVariables } from "../env";
import { apiError } from "../errors";
import { findNutritionistByUserId } from "../queries/me";

/**
 * user → nutritionist. Misma búsqueda que `requireNutritionist()` de apps/web
 * (`apps/web/src/lib/session.ts`) pero sin `redirect`:
 *
 * - Sin sesión (no corrió `requireSession` o no hay user) → 401.
 * - Usuario sin fila en `nutritionists` → 403. A diferencia del panel, la API no
 *   crea el perfil al vuelo: un GET no debe tener efectos y el onboarding (slug,
 *   nombre) vive en la web.
 *
 * Toda query posterior filtra por `c.get("nutritionist").id` (regla dura #1).
 */
export const requireNutritionist = createMiddleware<{ Variables: TenantVariables }>(async (c, next) => {
  // Tipado como presente, pero si alguien monta este middleware sin `requireSession` llega undefined.
  const user = c.get("user") as SessionVariables["user"] | undefined;
  if (!user) return apiError(c, 401, "unauthorized", "Inicia sesión para continuar");

  const nutritionist = await findNutritionistByUserId(user.id);
  if (!nutritionist) {
    return apiError(c, 403, "forbidden", "Tu cuenta no tiene perfil de nutrióloga. Termina tu registro en la web.");
  }

  c.set("nutritionist", nutritionist);
  await next();
});
