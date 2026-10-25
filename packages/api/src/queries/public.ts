import { getCalendarBusy } from "@granola/google-calendar";
import type { AvailabilityOverride, AvailabilityRule, Interval } from "@granola/core/scheduling";
import {
  and,
  appointments,
  availabilityOverrides,
  availabilityRules,
  db,
  eq,
  gt,
  inArray,
  lt,
  nutritionists,
  services,
} from "@granola/db";

/**
 * Queries públicas (sin sesión). Copia de `apps/web/src/lib/booking.ts` para que
 * el paquete no dependa de Next (`server-only`, `next/headers`). Si cambias la
 * lista blanca allá, cámbiala aquí también.
 */

/** Estados que ocupan agenda. */
export const BUSY_STATUSES = ["confirmed", "pending_payment"] as const;

export type PublicNutritionist = {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  timezone: string;
  bufferMin: number;
  minNoticeMin: number;
  slotStepMin: number;
};

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  currency: string;
  modality: "online" | "presencial" | "ambas";
  location: string | null;
  paymentMode: "prepaid" | "at_visit" | "optional";
};

/** Lista blanca: nunca phone_wa, cedula, tokens, ids de Stripe/MP ni plan. */
export const PUBLIC_NUTRITIONIST_COLUMNS = {
  id: true,
  slug: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  timezone: true,
  bufferMin: true,
  minNoticeMin: true,
  slotStepMin: true,
} as const;

const PUBLIC_SERVICE_COLUMNS = {
  id: true,
  name: true,
  description: true,
  durationMin: true,
  priceCents: true,
  currency: true,
  modality: true,
  location: true,
  paymentMode: true,
} as const;

export async function getPublicNutritionistBySlug(slug: string): Promise<PublicNutritionist | null> {
  const row = await db.query.nutritionists.findFirst({
    where: eq(nutritionists.slug, slug),
    columns: PUBLIC_NUTRITIONIST_COLUMNS,
  });
  return row ?? null;
}

export async function getActiveServices(nutritionistId: string): Promise<PublicService[]> {
  return db.query.services.findMany({
    where: and(eq(services.nutritionistId, nutritionistId), eq(services.isActive, true)),
    orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.createdAt)],
    columns: PUBLIC_SERVICE_COLUMNS,
  });
}

export async function getActiveService(nutritionistId: string, serviceId: string): Promise<PublicService | null> {
  const row = await db.query.services.findFirst({
    where: and(
      eq(services.id, serviceId),
      eq(services.nutritionistId, nutritionistId),
      eq(services.isActive, true),
    ),
    columns: PUBLIC_SERVICE_COLUMNS,
  });
  return row ?? null;
}

export type SchedulingContext = {
  rules: AvailabilityRule[];
  overrides: AvailabilityOverride[];
  busy: Interval[];
};

/** Reglas, excepciones y citas que ocupan agenda en [from, to]. */
export async function loadSchedulingContext(nutritionistId: string, from: Date, to: Date): Promise<SchedulingContext> {
  const [rules, overrides, busy] = await Promise.all([
    db
      .select({
        weekday: availabilityRules.weekday,
        startTime: availabilityRules.startTime,
        endTime: availabilityRules.endTime,
      })
      .from(availabilityRules)
      .where(eq(availabilityRules.nutritionistId, nutritionistId)),
    db
      .select({
        date: availabilityOverrides.date,
        startTime: availabilityOverrides.startTime,
        endTime: availabilityOverrides.endTime,
        isBlocked: availabilityOverrides.isBlocked,
      })
      .from(availabilityOverrides)
      .where(eq(availabilityOverrides.nutritionistId, nutritionistId)),
    db
      .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt })
      .from(appointments)
      .where(
        and(
          eq(appointments.nutritionistId, nutritionistId),
          inArray(appointments.status, [...BUSY_STATUSES]),
          lt(appointments.startsAt, to),
          gt(appointments.endsAt, from),
        ),
      ),
  ]);
  const profile = await db.query.nutritionists.findFirst({
    where: eq(nutritionists.id, nutritionistId), columns: { googleRefreshTokenEnc: true },
  });
  const calendarBusy = await getCalendarBusy({
    nutritionistId, encryptedRefreshToken: profile?.googleRefreshTokenEnc ?? null, from, to,
  });
  return { rules, overrides, busy: [...busy, ...calendarBusy] };
}
