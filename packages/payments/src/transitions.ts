import { and, appointments, db, eq, ne, payments } from "@granola/db";

import { shouldApplyTransition, type PaymentStatus, type StatusTransition } from "./status";

export type PaymentRow = typeof payments.$inferSelect;

/** Datos del evento Inngest `appointment/confirmed` que el webhook debe emitir. */
export type ConfirmedEvent = { appointmentId: string; nutritionistId: string };

export type ApplyTransitionResult =
  | { applied: false; reason: "not_found" | "noop" | "already_processed"; payment?: PaymentRow }
  | { applied: true; payment: PaymentRow; confirmed: ConfirmedEvent | null };

/**
 * Aplica una transición de estado a un pago identificado por `providerRef`
 * (session.id de Stripe / id de pago de MP). Idempotente: el UPDATE lleva
 * `WHERE status <> next` y si no afecta filas, el webhook ya se procesó.
 *
 * Nota: el driver neon-http no soporta transacciones; el orden pago → cita es
 * seguro porque la cita solo se confirma si el UPDATE del pago devolvió fila.
 */
export async function applyPaymentTransition(
  providerRef: string,
  next: StatusTransition,
): Promise<ApplyTransitionResult> {
  if (next === null) return { applied: false, reason: "noop" };

  const current = await db.query.payments.findFirst({ where: eq(payments.providerRef, providerRef) });
  if (!current) return { applied: false, reason: "not_found" };

  if (!shouldApplyTransition(current.status as PaymentStatus, next)) {
    return { applied: false, reason: "already_processed", payment: current };
  }

  const now = new Date();
  const [updated] = await db
    .update(payments)
    .set({
      status: next,
      paidAt: next === "paid" ? now : current.paidAt,
      updatedAt: now,
    })
    .where(and(eq(payments.providerRef, providerRef), ne(payments.status, next)))
    .returning();

  // Carrera: otro webhook idéntico ganó entre el SELECT y el UPDATE.
  if (!updated) return { applied: false, reason: "already_processed", payment: current };

  if (next !== "paid") return { applied: true, payment: updated, confirmed: null };

  // Solo confirmamos citas que estaban esperando pago; una cancelada no revive.
  const [appt] = await db
    .update(appointments)
    .set({ status: "confirmed", updatedAt: now })
    .where(and(eq(appointments.id, updated.appointmentId), eq(appointments.status, "pending_payment")))
    .returning({ id: appointments.id, nutritionistId: appointments.nutritionistId });

  return {
    applied: true,
    payment: updated,
    confirmed: appt ? { appointmentId: appt.id, nutritionistId: appt.nutritionistId } : null,
  };
}
