import { computeSlots } from "@granola/core/scheduling";
import { Hono } from "hono";
import { z } from "zod";

import type { AppEnv } from "../env";
import { apiError } from "../errors";
import { rateLimit } from "../middleware/rate-limit";
import {
  getActiveService,
  getActiveServices,
  getPublicNutritionistBySlug,
  loadSchedulingContext,
  type PublicNutritionist,
} from "../queries/public";
import { validate } from "../validator";

/** Días hacia adelante que se ofrecen (igual que BOOKING_HORIZON_DAYS en apps/web). */
export const PUBLIC_HORIZON_DAYS = 28;
const DAY_MS = 86_400_000;

/** Mismo formato que SLUG_RE de apps/web/src/components/public-profile/types.ts. */
const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Slug inválido");

const slugParam = z.object({ slug: slugSchema });

const slotsQuery = z.object({
  serviceId: z.uuid(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
});

/** Perfil público: solo columnas de la lista blanca, sin datos de agenda internos. */
function toPublicProfile(n: PublicNutritionist) {
  return {
    slug: n.slug,
    displayName: n.displayName,
    bio: n.bio,
    avatarUrl: n.avatarUrl,
    timezone: n.timezone,
  };
}

/** Anónimo: 60 requests/min por IP y ruta. */
const publicLimit = rateLimit({ limit: 60, windowMs: 60_000 });

export const publicRoutes = new Hono<AppEnv>()
  .get("/:slug", publicLimit, validate("param", slugParam), async (c) => {
    const { slug } = c.req.valid("param");
    const nutri = await getPublicNutritionistBySlug(slug);
    if (!nutri) return apiError(c, 404, "not_found", "Página no encontrada");

    const services = await getActiveServices(nutri.id);
    c.header("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    return c.json({ nutritionist: toPublicProfile(nutri), services });
  })
  .get("/:slug/slots", publicLimit, validate("param", slugParam), validate("query", slotsQuery), async (c) => {
    const { slug } = c.req.valid("param");
    const q = c.req.valid("query");

    const now = new Date();
    const horizon = new Date(now.getTime() + PUBLIC_HORIZON_DAYS * DAY_MS);
    const from = q.from ? new Date(Math.max(Date.parse(q.from), now.getTime())) : now;
    const to = q.to ? new Date(Math.min(Date.parse(q.to), horizon.getTime())) : horizon;
    if (to.getTime() <= from.getTime()) {
      return apiError(c, 400, "validation_error", `Rango inválido: \`to\` debe ser posterior a \`from\` y dentro de ${PUBLIC_HORIZON_DAYS} días`);
    }

    const nutri = await getPublicNutritionistBySlug(slug);
    if (!nutri) return apiError(c, 404, "not_found", "Página no encontrada");
    const service = await getActiveService(nutri.id, q.serviceId);
    if (!service) return apiError(c, 404, "not_found", "Servicio no disponible");

    const ctx = await loadSchedulingContext(nutri.id, from, to);
    const slots = computeSlots({
      ...ctx,
      service,
      from,
      to,
      timezone: nutri.timezone,
      now,
      bufferMin: nutri.bufferMin,
      minNoticeMin: nutri.minNoticeMin,
      stepMin: nutri.slotStepMin,
    });

    c.header("Cache-Control", "no-store");
    return c.json({
      timezone: nutri.timezone,
      service: { id: service.id, durationMin: service.durationMin },
      from: from.toISOString(),
      to: to.toISOString(),
      slots: slots.map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })),
    });
  });
