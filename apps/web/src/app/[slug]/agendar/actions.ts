"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createCheckout } from "@granola/payments";

import { bookingSchema, type BookingInput } from "@/components/booking/booking-schema";
import { normalizePhoneE164 } from "@/components/booking/phone";
import { and, appointments, db, eq, patients } from "@/lib/db";
import {
  checkSlotAvailable,
  computeAvailableSlots,
  generateCancelToken,
  getActiveService,
  getClientIp,
  getPublicNutritionistBySlug,
  hasEarlierConflict,
} from "@/lib/booking";
import { sendEvent } from "@/lib/inngest-client";

export type SlotsResult =
  | { ok: true; slots: { startsAt: string; endsAt: string }[]; nutritionistTimezone: string }
  | { ok: false; error: string };

/** Slots (UTC, ISO) de las próximas 4 semanas para un servicio activo. */
export async function fetchSlots(input: { slug: string; serviceId: string }): Promise<SlotsResult> {
  const parsed = z.object({ slug: z.string().min(1).max(60), serviceId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Solicitud inválida" };

  const nutri = await getPublicNutritionistBySlug(parsed.data.slug);
  if (!nutri) return { ok: false, error: "Página no encontrada" };
  const service = await getActiveService(nutri.id, parsed.data.serviceId);
  if (!service) return { ok: false, error: "Servicio no disponible" };

  const slots = await computeAvailableSlots({
    nutritionistId: nutri.id,
    timezone: nutri.timezone,
    service,
  });
  return {
    ok: true,
    nutritionistTimezone: nutri.timezone,
    slots: slots.map((s) => ({ startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString() })),
  };
}

export type BookingResult = { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Crea paciente (upsert por WhatsApp) + cita. Si todo sale bien redirige a la
 * página de confirmación (o al checkout si el servicio es prepagado).
 */
export async function createBooking(input: BookingInput): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0] ?? "_")] ??= i.message;
    return { ok: false, error: "Revisa los datos", fieldErrors: fe };
  }
  const d = parsed.data;

  const phone = normalizePhoneE164(d.phone, d.dialCode);
  if (!phone.ok) return { ok: false, error: "Revisa los datos", fieldErrors: { phone: phone.error } };

  const nutri = await getPublicNutritionistBySlug(d.slug);
  if (!nutri) return { ok: false, error: "Página no encontrada" };
  const service = await getActiveService(nutri.id, d.serviceId);
  if (!service) return { ok: false, error: "Ese servicio ya no está disponible" };

  if (service.modality !== "ambas" && service.modality !== d.modality) {
    return { ok: false, error: "Modalidad no válida para este servicio" };
  }

  const startsAt = new Date(d.startsAt);
  const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
  const slot = { startsAt, endsAt };

  const free = await checkSlotAvailable({ nutritionistId: nutri.id, timezone: nutri.timezone, service, slot });
  if (!free) return { ok: false, error: "Ese horario se acaba de ocupar. Elige otro, por favor." };

  // --- Paciente: upsert por (nutritionistId, phoneWa). Consentimiento LFPDPPP obligatorio.
  const ip = await getClientIp();
  const existing = await db.query.patients.findFirst({
    where: and(eq(patients.nutritionistId, nutri.id), eq(patients.phoneWa, phone.e164)),
    columns: { id: true },
  });
  let patientId: string;
  if (existing) {
    patientId = existing.id;
    await db
      .update(patients)
      .set({ name: d.name, email: d.email || undefined, updatedAt: new Date() })
      .where(eq(patients.id, patientId));
  } else {
    const [row] = await db
      .insert(patients)
      .values({
        nutritionistId: nutri.id,
        name: d.name,
        phoneWa: phone.e164,
        email: d.email || null,
        consentAt: new Date(),
        consentIp: ip,
        source: "booking",
      })
      .returning({ id: patients.id });
    patientId = row!.id;
  }

  // --- Cita
  const cancelToken = generateCancelToken();
  const prepaid = service.paymentMode === "prepaid";
  const [appt] = await db
    .insert(appointments)
    .values({
      nutritionistId: nutri.id,
      patientId,
      serviceId: service.id,
      startsAt,
      endsAt,
      status: prepaid ? "pending_payment" : "confirmed",
      modality: d.modality,
      cancelToken,
    })
    .returning({ id: appointments.id, createdAt: appointments.createdAt });

  // Sin transacciones en neon-http: si otra reserva ganó la carrera, deshacemos la nuestra.
  if (await hasEarlierConflict({ id: appt!.id, nutritionistId: nutri.id, startsAt, endsAt, createdAt: appt!.createdAt })) {
    await db.delete(appointments).where(eq(appointments.id, appt!.id));
    return { ok: false, error: "Ese horario se acaba de ocupar. Elige otro, por favor." };
  }

  const base = `/${nutri.slug}/agendar/listo?cita=${encodeURIComponent(cancelToken)}`;

  if (prepaid) {
    let checkoutUrl: string | null = null;
    try {
      const result = await createCheckout({
        appointmentId: appt!.id,
        nutritionistId: nutri.id,
        amountCents: service.priceCents,
        currency: "MXN",
        method: d.paymentMethod ?? "card",
        description: `${service.name} con ${nutri.displayName}`,
        payer: { name: d.name, email: d.email || undefined, phone: phone.e164 },
        successUrl: absoluteUrl(base),
        cancelUrl: absoluteUrl(`/cita/${encodeURIComponent(cancelToken)}`),
      });
      checkoutUrl = result.url;
    } catch (err) {
      // TODO(payments): packages/payments aún no implementa createCheckout (workstream F).
      // Mientras, dejamos la cita confirmada y avisamos que el pago en línea viene pronto;
      // la nutri cobra en consulta. Cuando exista, quitar este fallback y dejar pending_payment.
      console.warn("[booking] createCheckout no disponible:", err instanceof Error ? err.message : err);
      await db
        .update(appointments)
        .set({ status: "confirmed", updatedAt: new Date() })
        .where(eq(appointments.id, appt!.id));
      await sendEvent({ name: "appointment/confirmed", data: { appointmentId: appt!.id, nutritionistId: nutri.id } });
      redirect(`${base}&pago=pendiente`);
    }
    if (checkoutUrl) redirect(checkoutUrl);
  }

  await sendEvent({ name: "appointment/confirmed", data: { appointmentId: appt!.id, nutritionistId: nutri.id } });
  redirect(base);
}

function absoluteUrl(path: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const withProto = origin.startsWith("http") ? origin : `https://${origin}`;
  return `${withProto.replace(/\/$/, "")}${path}`;
}
