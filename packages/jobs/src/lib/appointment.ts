import { appointments, db, eq } from "@granola/db";

/**
 * Snapshot de la cita con paciente, nutri y servicio. Fechas como ISO string
 * porque los resultados de `step.run` viajan serializados en JSON.
 */
export type AppointmentContext = {
  appointment: {
    id: string;
    nutritionistId: string;
    patientId: string;
    status: "pending_payment" | "confirmed" | "cancelled" | "no_show" | "completed";
    startsAt: string;
    endsAt: string;
    modality: "online" | "presencial";
    meetUrl: string | null;
    cancelToken: string;
    reminder24hSentAt: string | null;
    reminder2hSentAt: string | null;
    /** Zona IANA del paciente detectada al agendar; null → usar la del nutri. */
    patientTimezone: string | null;
  };
  patient: { id: string; name: string; phoneWa: string | null };
  nutritionist: { id: string; displayName: string; slug: string; phoneWa: string | null; timezone: string };
  service: { id: string; name: string; location: string | null; priceCents: number; currency: string; paymentMode: "prepaid" | "at_visit" | "optional" };
};

/** Relee la cita de la DB. Null si ya no existe. */
export async function loadAppointment(appointmentId: string): Promise<AppointmentContext | null> {
  const row = await db.query.appointments.findFirst({
    where: eq(appointments.id, appointmentId),
    with: { patient: true, nutritionist: true, service: true },
  });
  if (!row) return null;
  return {
    appointment: {
      id: row.id,
      nutritionistId: row.nutritionistId,
      patientId: row.patientId,
      status: row.status,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      modality: row.modality,
      meetUrl: row.meetUrl,
      cancelToken: row.cancelToken,
      reminder24hSentAt: row.reminder24hSentAt?.toISOString() ?? null,
      reminder2hSentAt: row.reminder2hSentAt?.toISOString() ?? null,
      patientTimezone: row.patientTimezone ?? null,
    },
    patient: { id: row.patient.id, name: row.patient.name, phoneWa: row.patient.phoneWa },
    nutritionist: {
      id: row.nutritionist.id,
      displayName: row.nutritionist.displayName,
      slug: row.nutritionist.slug,
      phoneWa: row.nutritionist.phoneWa,
      timezone: row.nutritionist.timezone,
    },
    service: {
      id: row.service.id,
      name: row.service.name,
      location: row.service.location,
      priceCents: row.service.priceCents,
      currency: row.service.currency,
      paymentMode: row.service.paymentMode,
    },
  };
}

/** Primer nombre para el saludo ("Ana López" → "Ana"). */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}

/** Texto de {{5}} en nueva_cita_nutri según el modo de pago del servicio. */
export function paymentLabel(ctx: AppointmentContext): string {
  if (ctx.service.priceCents === 0) return "sin costo";
  switch (ctx.service.paymentMode) {
    case "prepaid":
      return ctx.appointment.status === "pending_payment" ? "pago pendiente (OXXO/SPEI)" : "pagado en línea";
    case "at_visit":
      return "se cobra en consulta";
    case "optional":
      return ctx.appointment.status === "pending_payment" ? "pago pendiente" : "pago opcional en línea";
  }
}
