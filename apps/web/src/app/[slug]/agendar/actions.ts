"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { isValidTimeZone } from "@granola/core/scheduling";
import { createCheckout } from "@granola/payments";

import { bookingSchema, type BookingInput } from "@/components/booking/booking-schema";
import { normalizePhoneE164 } from "@/components/booking/phone";
import { and, appointments, db, eq, isExclusionViolation, isNull, patients, payments } from "@/lib/db";
import {
  checkSlotAvailable,
  computeAvailableSlots,
  generateCancelToken,
  getActiveService,
  getClientIp,
  getPublicNutritionistBySlug,
} from "@/lib/booking";
import { sendEvent } from "@/lib/inngest-client";

import { decideBookingOutcome, initialAppointmentStatus, listoPath, type CheckoutAttempt } from "./outcome";

const SLOT_TAKEN_ERROR = "Ese horario se acaba de ocupar. Elige otro, por favor.";

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
    settings: nutri,
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
 * página de confirmación, al Checkout de Stripe (tarjeta) o a /listo con las
 * instrucciones de SPEI/OXXO. La decisión vive en `decideBookingOutcome()`.
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

  const free = await checkSlotAvailable({
    nutritionistId: nutri.id,
    timezone: nutri.timezone,
    settings: nutri,
    service,
    slot,
  });
  if (!free) return { ok: false, error: SLOT_TAKEN_ERROR };

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

  // --- Cita. Prepagado → pending_payment (ocupa el slot mientras paga).
  const cancelToken = generateCancelToken();
  const patientTimezone = d.timezone && isValidTimeZone(d.timezone) ? d.timezone : null;
  let appt: { id: string } | undefined;
  try {
    [appt] = await db
      .insert(appointments)
      .values({
        nutritionistId: nutri.id,
        patientId,
        serviceId: service.id,
        startsAt,
        endsAt,
        status: initialAppointmentStatus(service.paymentMode),
        modality: d.modality,
        cancelToken,
        patientTimezone,
        notes: d.notes || null,
      })
      .returning({ id: appointments.id });
  } catch (err) {
    // appointments_no_overlap (23P01): otra reserva ganó el hueco entre la revalidación y el INSERT.
    if (isExclusionViolation(err)) return { ok: false, error: SLOT_TAKEN_ERROR };
    throw err;
  }
  if (!appt) return { ok: false, error: "No pudimos agendar. Intenta de nuevo." };
  const appointmentId = appt.id;

  // --- Cobro (solo prepagado).
  let checkout: CheckoutAttempt = null;
  if (service.paymentMode === "prepaid") {
    const method = d.paymentMethod ?? "card";
    try {
      const result = await createCheckout({
        appointmentId,
        nutritionistId: nutri.id,
        amountCents: service.priceCents,
        currency: "MXN",
        method,
        description: `${service.name} con ${nutri.displayName}`,
        payer: { name: d.name, email: d.email || undefined, phone: phone.e164 },
        successUrl: absoluteUrl(listoPath(nutri.slug, cancelToken, "ok")),
        cancelUrl: absoluteUrl(`/cita/${encodeURIComponent(cancelToken)}`),
      });
      checkout = { ok: true, method, result };
    } catch (err) {
      checkout = { ok: false, error: err };
    }
  }

  const outcome = decideBookingOutcome({
    slug: nutri.slug,
    cancelToken,
    paymentMode: service.paymentMode,
    startsAt,
    now: new Date(),
    checkout,
  });

  switch (outcome.kind) {
    case "failed": {
      console.error(
        "[booking] createCheckout falló; se borra la cita",
        checkout && !checkout.ok ? checkout.error : undefined,
      );
      // ON DELETE CASCADE borra también el `payments` pending que haya quedado.
      await db.delete(appointments).where(eq(appointments.id, appointmentId));
      return { ok: false, error: outcome.error };
    }
    case "confirmed": {
      if (outcome.degraded) {
        // La nutri aún no conecta cobros: la cita se confirma y se paga en consulta.
        console.warn("[booking] pagos en línea no disponibles; se confirma y se paga en consulta", {
          nutritionistId: nutri.id,
          reason: checkout && !checkout.ok && checkout.error instanceof Error ? checkout.error.message : undefined,
        });
        await db.batch([
          db
            .update(appointments)
            .set({ status: outcome.finalStatus, updatedAt: new Date() })
            .where(eq(appointments.id, appointmentId)),
          // MP inserta el `payments` antes de hablar con el proveedor; si faltaban keys queda huérfano.
          db
            .delete(payments)
            .where(
              and(eq(payments.appointmentId, appointmentId), eq(payments.status, "pending"), isNull(payments.providerRef)),
            ),
        ]);
      }
      await sendEvent({ name: outcome.emit.name, data: { appointmentId, nutritionistId: nutri.id } });
      redirect(outcome.redirectTo);
    }
    case "awaiting_payment": {
      await sendEvent({
        name: outcome.emit.name,
        data: { appointmentId, nutritionistId: nutri.id, expiresAt: outcome.emit.expiresAt },
      });
      redirect(outcome.redirectTo);
    }
  }
}

function absoluteUrl(path: string): string {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const withProto = origin.startsWith("http") ? origin : `https://${origin}`;
  return `${withProto.replace(/\/$/, "")}${path}`;
}
