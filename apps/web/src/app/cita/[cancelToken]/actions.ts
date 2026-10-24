"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { appointments, db, eq } from "@/lib/db";
import { checkSlotAvailable, computeAvailableSlots, getPublicNutritionistById } from "@/lib/booking";
import { sendEvent } from "@/lib/inngest-client";

export type PatientActionResult = { ok: true } | { ok: false; error: string };

const tokenSchema = z.string().min(16).max(64);

/** Horas de antelación mínima para que el paciente cancele/reagende por su cuenta. */
const PATIENT_CHANGE_MIN_HOURS = 2;

async function loadByToken(token: string) {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return null;
  return db.query.appointments.findFirst({
    where: eq(appointments.cancelToken, parsed.data),
    columns: { id: true, nutritionistId: true, serviceId: true, startsAt: true, endsAt: true, status: true },
    with: { service: { columns: { durationMin: true, isActive: true } } },
  });
}

function canPatientChange(appt: { status: string; startsAt: Date }): string | null {
  if (appt.status === "cancelled") return "Esta cita ya está cancelada";
  if (appt.status === "completed" || appt.status === "no_show") return "Esta cita ya ocurrió";
  if (appt.startsAt.getTime() - Date.now() < PATIENT_CHANGE_MIN_HOURS * 3_600_000) {
    return `Faltan menos de ${PATIENT_CHANGE_MIN_HOURS} horas. Escríbele directamente a tu nutrióloga.`;
  }
  return null;
}

export async function cancelByPatient(token: string): Promise<PatientActionResult> {
  const appt = await loadByToken(token);
  if (!appt) return { ok: false, error: "Cita no encontrada" };
  const blocked = canPatientChange(appt);
  if (blocked) return { ok: false, error: blocked };

  await db
    .update(appointments)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: "Cancelada por el paciente", updatedAt: new Date() })
    .where(eq(appointments.id, appt.id));

  await sendEvent({
    name: "appointment/cancelled",
    data: { appointmentId: appt.id, nutritionistId: appt.nutritionistId, by: "patient" },
  });

  revalidatePath(`/cita/${token}`);
  return { ok: true };
}

export type RescheduleSlotsResult =
  | { ok: true; slots: { startsAt: string; endsAt: string }[] }
  | { ok: false; error: string };

export async function fetchRescheduleSlots(token: string): Promise<RescheduleSlotsResult> {
  const appt = await loadByToken(token);
  if (!appt) return { ok: false, error: "Cita no encontrada" };
  const blocked = canPatientChange(appt);
  if (blocked) return { ok: false, error: blocked };
  const nutri = await getPublicNutritionistById(appt.nutritionistId);
  if (!nutri) return { ok: false, error: "Cita no encontrada" };

  const slots = await computeAvailableSlots({
    nutritionistId: nutri.id,
    timezone: nutri.timezone,
    service: appt.service,
    excludeAppointmentId: appt.id,
  });
  return {
    ok: true,
    slots: slots.map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })),
  };
}

export async function rescheduleByPatient(token: string, startsAtIso: string): Promise<PatientActionResult> {
  const parsed = z.iso.datetime().safeParse(startsAtIso);
  if (!parsed.success) return { ok: false, error: "Horario inválido" };

  const appt = await loadByToken(token);
  if (!appt) return { ok: false, error: "Cita no encontrada" };
  const blocked = canPatientChange(appt);
  if (blocked) return { ok: false, error: blocked };
  const nutri = await getPublicNutritionistById(appt.nutritionistId);
  if (!nutri) return { ok: false, error: "Cita no encontrada" };

  const startsAt = new Date(parsed.data);
  const endsAt = new Date(startsAt.getTime() + appt.service.durationMin * 60_000);
  if (startsAt.getTime() === appt.startsAt.getTime()) return { ok: false, error: "Es el mismo horario" };

  const free = await checkSlotAvailable({
    nutritionistId: nutri.id,
    timezone: nutri.timezone,
    service: appt.service,
    slot: { startsAt, endsAt },
    excludeAppointmentId: appt.id,
  });
  if (!free) return { ok: false, error: "Ese horario se acaba de ocupar. Elige otro, por favor." };

  const previousStartsAt = appt.startsAt.toISOString();
  await db
    .update(appointments)
    .set({ startsAt, endsAt, reminder24hSentAt: null, reminder2hSentAt: null, updatedAt: new Date() })
    .where(eq(appointments.id, appt.id));

  await sendEvent({
    name: "appointment/rescheduled",
    data: { appointmentId: appt.id, nutritionistId: appt.nutritionistId, previousStartsAt },
  });

  revalidatePath(`/cita/${token}`);
  return { ok: true };
}
