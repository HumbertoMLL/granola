"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isValidTimeZone, parseTimeToMinutes } from "@granola/core/scheduling";

import {
  overrideSchema,
  ruleSchema,
  serviceSchema,
  type OverrideInput,
  type RuleInput,
  type ServiceInput,
} from "@/components/agenda/schemas";

import {
  and,
  appointments,
  availabilityOverrides,
  availabilityRules,
  db,
  eq,
  nutritionists,
  services,
  sql,
} from "@/lib/db";
import { sendEvent } from "@/lib/inngest-client";
import { requireNutritionist } from "@/lib/session";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const AGENDA_PATH = "/app/agenda";

function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Servicios                                                           */
/* ------------------------------------------------------------------ */

export async function createService(input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  const { nutritionist } = await requireNutritionist();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return fail("Revisa los campos", zodFieldErrors(parsed.error));
  const d = parsed.data;
  if (d.modality !== "online" && !d.location) {
    return fail("Revisa los campos", { location: "Indica dónde atiendes" });
  }

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${services.sortOrder}), -1)` })
    .from(services)
    .where(eq(services.nutritionistId, nutritionist.id));

  const [row] = await db
    .insert(services)
    .values({
      nutritionistId: nutritionist.id,
      name: d.name,
      description: d.description || null,
      durationMin: d.durationMin,
      priceCents: Math.round(d.priceMxn * 100),
      currency: "MXN",
      modality: d.modality,
      location: d.location || null,
      paymentMode: d.paymentMode,
      isActive: d.isActive,
      sortOrder: Number(max) + 1,
    })
    .returning({ id: services.id });

  revalidatePath(AGENDA_PATH);
  return { ok: true, data: { id: row!.id } };
}

export async function updateService(id: string, input: ServiceInput): Promise<ActionResult> {
  const { nutritionist } = await requireNutritionist();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return fail("Revisa los campos", zodFieldErrors(parsed.error));
  const d = parsed.data;
  if (d.modality !== "online" && !d.location) {
    return fail("Revisa los campos", { location: "Indica dónde atiendes" });
  }

  const res = await db
    .update(services)
    .set({
      name: d.name,
      description: d.description || null,
      durationMin: d.durationMin,
      priceCents: Math.round(d.priceMxn * 100),
      modality: d.modality,
      location: d.location || null,
      paymentMode: d.paymentMode,
      isActive: d.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(services.id, id), eq(services.nutritionistId, nutritionist.id)))
    .returning({ id: services.id });
  if (res.length === 0) return fail("Servicio no encontrado");

  revalidatePath(AGENDA_PATH);
  return { ok: true };
}

export async function toggleServiceActive(id: string, isActive: boolean): Promise<ActionResult> {
  const { nutritionist } = await requireNutritionist();
  const res = await db
    .update(services)
    .set({ isActive, updatedAt: new Date() })
    .where(and(eq(services.id, id), eq(services.nutritionistId, nutritionist.id)))
    .returning({ id: services.id });
  if (res.length === 0) return fail("Servicio no encontrado");
  revalidatePath(AGENDA_PATH);
  return { ok: true };
}

/** Borra si no tiene citas; si las tiene (FK restrict) lo desactiva. */
export async function deleteService(id: string): Promise<ActionResult<{ deactivated: boolean }>> {
  const { nutritionist } = await requireNutritionist();
  const owned = await db.query.services.findFirst({
    where: and(eq(services.id, id), eq(services.nutritionistId, nutritionist.id)),
    columns: { id: true },
  });
  if (!owned) return fail("Servicio no encontrado");

  const [used] = await db
    .select({ n: sql<number>`count(*)` })
    .from(appointments)
    .where(eq(appointments.serviceId, id));
  if (Number(used?.n ?? 0) > 0) {
    await db.update(services).set({ isActive: false, updatedAt: new Date() }).where(eq(services.id, id));
    revalidatePath(AGENDA_PATH);
    return { ok: true, data: { deactivated: true } };
  }
  await db.delete(services).where(eq(services.id, id));
  revalidatePath(AGENDA_PATH);
  return { ok: true, data: { deactivated: false } };
}

/** Reordena: recibe la lista completa de ids en el orden deseado. */
export async function reorderServices(orderedIds: string[]): Promise<ActionResult> {
  const { nutritionist } = await requireNutritionist();
  const parsed = z.array(z.uuid()).min(1).max(100).safeParse(orderedIds);
  if (!parsed.success) return fail("Orden inválido");

  const updates = parsed.data.map((id, i) =>
    db
      .update(services)
      .set({ sortOrder: i })
      .where(and(eq(services.id, id), eq(services.nutritionistId, nutritionist.id))),
  );
  const [first, ...rest] = updates;
  if (first) await db.batch([first, ...rest]);

  revalidatePath(AGENDA_PATH);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Disponibilidad                                                      */
/* ------------------------------------------------------------------ */

/** Reemplaza TODAS las reglas semanales del nutri (editor completo). */
export async function saveAvailabilityRules(rules: RuleInput[]): Promise<ActionResult> {
  const { nutritionist } = await requireNutritionist();
  const parsed = z.array(ruleSchema).max(7 * 6, "Demasiadas ventanas").safeParse(rules);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Horario inválido");

  // Ventanas del mismo día no deben solaparse.
  for (let i = 0; i < parsed.data.length; i++) {
    for (let j = i + 1; j < parsed.data.length; j++) {
      const a = parsed.data[i]!;
      const b = parsed.data[j]!;
      if (a.weekday !== b.weekday) continue;
      const aS = parseTimeToMinutes(a.startTime);
      const aE = parseTimeToMinutes(a.endTime);
      const bS = parseTimeToMinutes(b.startTime);
      const bE = parseTimeToMinutes(b.endTime);
      if (aS < bE && bS < aE) return fail("Hay ventanas que se encima el mismo día");
    }
  }

  const del = db.delete(availabilityRules).where(eq(availabilityRules.nutritionistId, nutritionist.id));
  if (parsed.data.length === 0) {
    await del;
  } else {
    const ins = db.insert(availabilityRules).values(
      parsed.data.map((r) => ({
        nutritionistId: nutritionist.id,
        weekday: r.weekday,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
    );
    await db.batch([del, ins]);
  }

  revalidatePath(AGENDA_PATH);
  return { ok: true };
}

export async function addAvailabilityOverride(input: OverrideInput): Promise<ActionResult<{ id: string }>> {
  const { nutritionist } = await requireNutritionist();
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Datos inválidos");
  const [row] = await db
    .insert(availabilityOverrides)
    .values({ nutritionistId: nutritionist.id, ...parsed.data })
    .returning({ id: availabilityOverrides.id });
  revalidatePath(AGENDA_PATH);
  return { ok: true, data: { id: row!.id } };
}

export async function deleteAvailabilityOverride(id: string): Promise<ActionResult> {
  const { nutritionist } = await requireNutritionist();
  const res = await db
    .delete(availabilityOverrides)
    .where(and(eq(availabilityOverrides.id, id), eq(availabilityOverrides.nutritionistId, nutritionist.id)))
    .returning({ id: availabilityOverrides.id });
  if (res.length === 0) return fail("Excepción no encontrada");
  revalidatePath(AGENDA_PATH);
  return { ok: true };
}

export async function updateTimezone(timezone: string): Promise<ActionResult> {
  const { nutritionist } = await requireNutritionist();
  const parsed = z.string().min(1).max(64).safeParse(timezone);
  if (!parsed.success || !isValidTimeZone(parsed.data)) return fail("Zona horaria inválida");
  await db
    .update(nutritionists)
    .set({ timezone: parsed.data, updatedAt: new Date() })
    .where(eq(nutritionists.id, nutritionist.id));
  revalidatePath(AGENDA_PATH);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Citas                                                               */
/* ------------------------------------------------------------------ */

async function ownedAppointment(id: string, nutritionistId: string) {
  return db.query.appointments.findFirst({
    where: and(eq(appointments.id, id), eq(appointments.nutritionistId, nutritionistId)),
    columns: { id: true, status: true, startsAt: true, endsAt: true },
  });
}

export async function cancelAppointment(id: string, reason?: string): Promise<ActionResult> {
  const { nutritionist } = await requireNutritionist();
  const appt = await ownedAppointment(id, nutritionist.id);
  if (!appt) return fail("Cita no encontrada");
  if (appt.status === "cancelled") return fail("La cita ya estaba cancelada");
  if (appt.status === "completed") return fail("No se puede cancelar una cita completada");

  await db
    .update(appointments)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: reason?.trim().slice(0, 300) || "Cancelada por la nutrióloga",
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, id));

  await sendEvent({
    name: "appointment/cancelled",
    data: { appointmentId: id, nutritionistId: nutritionist.id, by: "nutritionist" },
  });

  revalidatePath(AGENDA_PATH);
  return { ok: true };
}

export async function completeAppointment(id: string): Promise<ActionResult> {
  const { nutritionist } = await requireNutritionist();
  const appt = await ownedAppointment(id, nutritionist.id);
  if (!appt) return fail("Cita no encontrada");
  if (appt.status === "cancelled") return fail("La cita está cancelada");

  await db
    .update(appointments)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(appointments.id, id));

  await sendEvent({
    name: "appointment/completed",
    data: { appointmentId: id, nutritionistId: nutritionist.id },
  });

  revalidatePath(AGENDA_PATH);
  return { ok: true };
}

export async function markNoShow(id: string): Promise<ActionResult> {
  const { nutritionist } = await requireNutritionist();
  const appt = await ownedAppointment(id, nutritionist.id);
  if (!appt) return fail("Cita no encontrada");
  if (appt.status === "cancelled") return fail("La cita está cancelada");
  if (appt.startsAt.getTime() > Date.now()) return fail("La cita aún no ha ocurrido");

  await db
    .update(appointments)
    .set({ status: "no_show", updatedAt: new Date() })
    .where(eq(appointments.id, id));

  revalidatePath(AGENDA_PATH);
  return { ok: true };
}

/** Pasa una cita pendiente de pago a confirmada (pago en efectivo / transferencia manual). */
export async function confirmAppointmentManually(id: string): Promise<ActionResult> {
  const { nutritionist } = await requireNutritionist();
  const appt = await ownedAppointment(id, nutritionist.id);
  if (!appt) return fail("Cita no encontrada");
  if (appt.status !== "pending_payment") return fail("Solo aplica a citas pendientes de pago");

  await db
    .update(appointments)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(eq(appointments.id, id));

  await sendEvent({
    name: "appointment/confirmed",
    data: { appointmentId: id, nutritionistId: nutritionist.id },
  });

  revalidatePath(AGENDA_PATH);
  return { ok: true };
}
