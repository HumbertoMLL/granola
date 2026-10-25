import "server-only";

import { randomBytes } from "node:crypto";

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

/** Días de disponibilidad que se ofrecen al paciente. */
export const BOOKING_HORIZON_DAYS = 28;

/**
 * Parámetros de agenda por nutri (`nutritionists.buffer_min`, `min_notice_min`,
 * `slot_step_min`; se editan en /app/agenda → Disponibilidad).
 */
export type SchedulingSettings = {
  bufferMin: number;
  minNoticeMin: number;
  slotStepMin: number;
};

/** Estados que ocupan agenda. */
export const BUSY_STATUSES = ["confirmed", "pending_payment"] as const;

export type PublicNutritionist = {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  timezone: string;
} & SchedulingSettings;

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

const PUBLIC_NUTRITIONIST_COLUMNS = {
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

/** Solo campos públicos: nunca phone_wa, tokens ni plan. */
export async function getPublicNutritionistBySlug(slug: string): Promise<PublicNutritionist | null> {
  const row = await db.query.nutritionists.findFirst({
    where: eq(nutritionists.slug, slug),
    columns: PUBLIC_NUTRITIONIST_COLUMNS,
  });
  return row ?? null;
}

export async function getPublicNutritionistById(id: string): Promise<PublicNutritionist | null> {
  const row = await db.query.nutritionists.findFirst({
    where: eq(nutritionists.id, id),
    columns: PUBLIC_NUTRITIONIST_COLUMNS,
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
  settings: SchedulingSettings;
  service: { durationMin: number };
  from?: Date;
  to?: Date;
  excludeAppointmentId?: string;
};

/** Slots ofrecibles (UTC) para un servicio en las próximas `horizonDays`. */
export async function computeAvailableSlots(input: AvailableSlotsInput): Promise<Slot[]> {
  const now = new Date();
  const from = input.from ?? now;
  const to = input.to ?? new Date(now.getTime() + BOOKING_HORIZON_DAYS * 86_400_000);
  const ctx = await loadSchedulingContext(input.nutritionistId, from, to, input.excludeAppointmentId);
  return computeSlots({
    ...ctx,
    service: input.service,
    from,
    to,
    timezone: input.timezone,
    now,
    bufferMin: input.settings.bufferMin,
    minNoticeMin: input.settings.minNoticeMin,
    stepMin: input.settings.slotStepMin,
  });
}

/** Revalida en servidor, leyendo la agenda actual, que el slot siga libre. */
export async function checkSlotAvailable(input: {
  nutritionistId: string;
  timezone: string;
  settings: SchedulingSettings;
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
    bufferMin: input.settings.bufferMin,
    minNoticeMin: input.settings.minNoticeMin,
    stepMin: input.settings.slotStepMin,
  });
}

/** Token opaco URL-safe (32 chars) para el link de reagendar/cancelar. */
export function generateCancelToken(): string {
  return randomBytes(24).toString("base64url");
}

// Vive en lib/request.ts; se reexporta para los imports existentes.
export { getClientIp } from "./request";
