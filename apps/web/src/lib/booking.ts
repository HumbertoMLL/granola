import "server-only";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";

import {
  computeSlots,
  isSlotAvailable,
  type AvailabilityOverride,
  type AvailabilityRule,
  type Interval,
  type Slot,
} from "@granola/core/scheduling";

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
  ne,
  nutritionists,
  services,
} from "@/lib/db";

/**
 * Parámetros de agenda que hoy no viven en el schema (ver reporte: harían falta
 * columnas `buffer_min`, `min_notice_min`, `slot_step_min` en `nutritionists`).
 */
export const BOOKING_DEFAULTS = {
  bufferMin: 0,
  minNoticeMin: 120,
  stepMin: 30,
  /** Semanas de disponibilidad que se ofrecen al paciente. */
  horizonDays: 28,
} as const;

/** Estados que ocupan agenda. */
export const BUSY_STATUSES = ["confirmed", "pending_payment"] as const;

export type PublicNutritionist = {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  timezone: string;
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

/** Solo campos públicos: nunca phone_wa, tokens ni plan. */
export async function getPublicNutritionistBySlug(slug: string): Promise<PublicNutritionist | null> {
  const row = await db.query.nutritionists.findFirst({
    where: eq(nutritionists.slug, slug),
    columns: { id: true, slug: true, displayName: true, bio: true, avatarUrl: true, timezone: true },
  });
  return row ?? null;
}

export async function getPublicNutritionistById(id: string): Promise<PublicNutritionist | null> {
  const row = await db.query.nutritionists.findFirst({
    where: eq(nutritionists.id, id),
    columns: { id: true, slug: true, displayName: true, bio: true, avatarUrl: true, timezone: true },
  });
  return row ?? null;
}

export async function getActiveServices(nutritionistId: string): Promise<PublicService[]> {
  const rows = await db.query.services.findMany({
    where: and(eq(services.nutritionistId, nutritionistId), eq(services.isActive, true)),
    orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.createdAt)],
    columns: {
      id: true,
      name: true,
      description: true,
      durationMin: true,
      priceCents: true,
      currency: true,
      modality: true,
      location: true,
      paymentMode: true,
    },
  });
  return rows;
}

export async function getActiveService(nutritionistId: string, serviceId: string): Promise<PublicService | null> {
  const row = await db.query.services.findFirst({
    where: and(
      eq(services.id, serviceId),
      eq(services.nutritionistId, nutritionistId),
      eq(services.isActive, true),
    ),
    columns: {
      id: true,
      name: true,
      description: true,
      durationMin: true,
      priceCents: true,
      currency: true,
      modality: true,
      location: true,
      paymentMode: true,
    },
  });
  return row ?? null;
}

export type SchedulingContext = {
  rules: AvailabilityRule[];
  overrides: AvailabilityOverride[];
  busy: Interval[];
};

/**
 * Reglas, excepciones y citas que ocupan agenda en [from, to].
 * `excludeAppointmentId` sirve al reagendar (la propia cita no se bloquea a sí misma).
 */
export async function loadSchedulingContext(
  nutritionistId: string,
  from: Date,
  to: Date,
  excludeAppointmentId?: string,
): Promise<SchedulingContext> {
  const busyWhere = [
    eq(appointments.nutritionistId, nutritionistId),
    inArray(appointments.status, [...BUSY_STATUSES]),
    lt(appointments.startsAt, to),
    gt(appointments.endsAt, from),
  ];
  if (excludeAppointmentId) busyWhere.push(ne(appointments.id, excludeAppointmentId));

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
      .where(and(...busyWhere)),
  ]);

  return { rules, overrides, busy };
}

export type AvailableSlotsInput = {
  nutritionistId: string;
  timezone: string;
  service: { durationMin: number };
  from?: Date;
  to?: Date;
  excludeAppointmentId?: string;
};

/** Slots ofrecibles (UTC) para un servicio en las próximas `horizonDays`. */
export async function computeAvailableSlots(input: AvailableSlotsInput): Promise<Slot[]> {
  const now = new Date();
  const from = input.from ?? now;
  const to = input.to ?? new Date(now.getTime() + BOOKING_DEFAULTS.horizonDays * 86_400_000);
  const ctx = await loadSchedulingContext(input.nutritionistId, from, to, input.excludeAppointmentId);
  return computeSlots({
    ...ctx,
    service: input.service,
    from,
    to,
    timezone: input.timezone,
    now,
    bufferMin: BOOKING_DEFAULTS.bufferMin,
    minNoticeMin: BOOKING_DEFAULTS.minNoticeMin,
    stepMin: BOOKING_DEFAULTS.stepMin,
  });
}

/** Revalida en servidor, leyendo la agenda actual, que el slot siga libre. */
export async function checkSlotAvailable(input: {
  nutritionistId: string;
  timezone: string;
  service: { durationMin: number };
  slot: Interval;
  excludeAppointmentId?: string;
}): Promise<boolean> {
  const from = new Date(input.slot.startsAt.getTime() - 86_400_000);
  const to = new Date(input.slot.endsAt.getTime() + 86_400_000);
  const ctx = await loadSchedulingContext(input.nutritionistId, from, to, input.excludeAppointmentId);
  return isSlotAvailable({
    ...ctx,
    service: input.service,
    slot: input.slot,
    timezone: input.timezone,
    now: new Date(),
    bufferMin: BOOKING_DEFAULTS.bufferMin,
    minNoticeMin: BOOKING_DEFAULTS.minNoticeMin,
    stepMin: BOOKING_DEFAULTS.stepMin,
  });
}

/**
 * Tras insertar, comprobamos que no se haya colado otra cita en el mismo hueco
 * (el driver HTTP de Neon no soporta transacciones interactivas). Devuelve true
 * si hay una cita *distinta* ocupando el intervalo y creada antes que la nuestra.
 */
export async function hasEarlierConflict(appt: {
  id: string;
  nutritionistId: string;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}): Promise<boolean> {
  const rows = await db
    .select({ id: appointments.id, createdAt: appointments.createdAt })
    .from(appointments)
    .where(
      and(
        eq(appointments.nutritionistId, appt.nutritionistId),
        ne(appointments.id, appt.id),
        inArray(appointments.status, [...BUSY_STATUSES]),
        lt(appointments.startsAt, appt.endsAt),
        gt(appointments.endsAt, appt.startsAt),
      ),
    );
  return rows.some((r) => r.createdAt.getTime() <= appt.createdAt.getTime());
}

/** Token opaco URL-safe (32 chars) para el link de reagendar/cancelar. */
export function generateCancelToken(): string {
  return randomBytes(24).toString("base64url");
}

/** IP del request (x-forwarded-for) para `patients.consent_ip`. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || h.get("x-real-ip") || "unknown";
}
