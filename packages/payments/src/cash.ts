import { and, appointments, db, eq, inArray, payments, services } from "@granola/db";

import { PaymentsError } from "./errors";

/**
 * "Marcar pagado en efectivo": el nutri cobró en consulta (servicio `at_visit`
 * u `optional` sin prepago). Inserta un `payments` provider=cash status=paid.
 * Sin providerRef (es null para efectivo); la idempotencia es "ya hay un pago
 * `paid` para esta cita → no duplicar".
 *
 * Siempre filtra por `nutritionistId` (regla dura #1).
 */
export async function markCashPaid(input: {
  nutritionistId: string;
  appointmentId: string;
  /** Si se omite, usa el precio del servicio. */
  amountCents?: number;
}): Promise<typeof payments.$inferSelect> {
  const appt = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      priceCents: services.priceCents,
      currency: services.currency,
      paymentMode: services.paymentMode,
    })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.id, input.appointmentId), eq(appointments.nutritionistId, input.nutritionistId)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!appt) throw new PaymentsError("appointment_not_found", "Cita no encontrada");
  if (appt.status === "cancelled") throw new PaymentsError("appointment_cancelled", "La cita está cancelada");

  const existing = await db.query.payments.findFirst({
    where: and(eq(payments.appointmentId, appt.id), inArray(payments.status, ["paid", "refunded"])),
  });
  if (existing) throw new PaymentsError("already_paid", "Esta cita ya tiene un pago registrado");

  const amountCents = input.amountCents ?? appt.priceCents;
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new PaymentsError("invalid_amount", "Monto inválido");
  }

  const now = new Date();
  const [payment] = await db
    .insert(payments)
    .values({
      appointmentId: appt.id,
      provider: "cash",
      method: "cash",
      status: "paid",
      amountCents,
      currency: appt.currency,
      paidAt: now,
    })
    .returning();
  if (!payment) throw new PaymentsError("insert_failed", "No se pudo registrar el pago");

  // Una cita at_visit/optional normalmente ya está confirmed; si por algo seguía
  // pending_payment, el cobro en efectivo la confirma.
  if (appt.status === "pending_payment") {
    await db
      .update(appointments)
      .set({ status: "confirmed", updatedAt: now })
      .where(eq(appointments.id, appt.id));
  }

  return payment;
}
