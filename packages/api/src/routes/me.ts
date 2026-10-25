import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv, Nutritionist } from "../env";
import { apiError } from "../errors";
import { requireSession } from "../middleware/session";
import { requireNutritionist } from "../middleware/tenant";
import { listAppointments } from "../queries/me";
import { validate } from "../validator";

const DAY_MS = 86_400_000;
/** Rango por defecto de /me/appointments. */
export const DEFAULT_RANGE_DAYS = 7;
/** Rango máximo por request (evita barridos de todo el historial). */
export const MAX_RANGE_DAYS = 93;

const rangeQuery = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

/** Lo que la nutri ve de su propio perfil. Nunca tokens (Google), ids de Stripe/MP ni requirements. */
function toMe(n: Nutritionist) {
  return {
    id: n.id,
    slug: n.slug,
    displayName: n.displayName,
    bio: n.bio,
    avatarUrl: n.avatarUrl,
    cedula: n.cedula,
    phoneWa: n.phoneWa,
    timezone: n.timezone,
    plan: n.plan,
    onboardingStep: n.onboardingStep,
    bufferMin: n.bufferMin,
    minNoticeMin: n.minNoticeMin,
    slotStepMin: n.slotStepMin,
    stripeChargesEnabled: n.stripeChargesEnabled,
  };
}

export const meRoutes = new Hono<AppEnv>()
  .use(requireSession, requireNutritionist)
  .get("/", (c) => {
    const user = c.get("user");
    return c.json({
      user: { id: user.id, email: user.email, name: user.name, image: user.image ?? null },
      nutritionist: toMe(c.get("nutritionist")),
    });
  })
  .get("/appointments", validate("query", rangeQuery), async (c) => {
    const q = c.req.valid("query");
    const from = q.from ? new Date(q.from) : new Date();
    const to = q.to ? new Date(q.to) : new Date(from.getTime() + DEFAULT_RANGE_DAYS * DAY_MS);

    if (to.getTime() <= from.getTime()) {
      return apiError(c, 400, "validation_error", "`to` debe ser posterior a `from`");
    }
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
      return apiError(c, 400, "validation_error", `El rango máximo es de ${MAX_RANGE_DAYS} días`);
    }

    const rows = await listAppointments(c.get("nutritionist").id, from, to);
    c.header("Cache-Control", "private, no-store");
    return c.json({ from: from.toISOString(), to: to.toISOString(), appointments: rows });
  });
