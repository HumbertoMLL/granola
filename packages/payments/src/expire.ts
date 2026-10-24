import { and, db, eq, payments } from "@granola/db";

import { isMercadoPagoConfigured, isStripeConfigured } from "./env";
import { getMpPayments } from "./mercadopago/client";
import { getStripe } from "./stripe/client";

export type ExpirePendingPaymentsResult = {
  /** Ids de `payments` que pasaron de `pending` a `expired`. */
  expired: string[];
  /** Cobros que no se pudieron anular en el proveedor (best-effort; se loggean). */
  providerCancelFailures: { paymentId: string; provider: "stripe" | "mercadopago"; message: string }[];
};

/** Valor de `payments.failure_reason` cuando el job de expiración libera el slot. */
export const APPOINTMENT_EXPIRED_REASON = "appointment_expired";

/**
 * La cita se canceló por falta de pago (`appointment/cancelled` con
 * `by: "system"`, job de expiración en @granola/jobs): todos sus `payments`
 * `pending` quedan `expired` con `failure_reason = "appointment_expired"`.
 *
 * Idempotente: el UPDATE solo toca filas `pending`; llamarla dos veces no hace nada.
 *
 * Además, best-effort, anula el cobro en el proveedor para que el paciente no
 * pague un slot que ya se liberó: expira la Checkout Session de Stripe y cancela
 * el pago SPEI/OXXO de MP. Si falla (ya expirado, sin keys…) solo se reporta.
 * El webhook que llega después (`checkout.session.expired` / MP `cancelled`) no
 * pisa el `expired` (ver `shouldApplyTransition`). Si aun así se paga tarde, el
 * pago queda `paid` pero la cita sigue cancelada (no revive): reembolso manual.
 */
export async function expirePendingPaymentsForAppointment(appointmentId: string): Promise<ExpirePendingPaymentsResult> {
  const now = new Date();
  const rows = await db
    .update(payments)
    .set({ status: "expired", failureReason: APPOINTMENT_EXPIRED_REASON, updatedAt: now })
    .where(and(eq(payments.appointmentId, appointmentId), eq(payments.status, "pending")))
    .returning({ id: payments.id, provider: payments.provider, providerRef: payments.providerRef });

  const providerCancelFailures: ExpirePendingPaymentsResult["providerCancelFailures"] = [];
  for (const row of rows) {
    if (!row.providerRef) continue;
    try {
      if (row.provider === "stripe" && isStripeConfigured()) {
        await getStripe().checkout.sessions.expire(row.providerRef);
      } else if (row.provider === "mercadopago" && isMercadoPagoConfigured()) {
        await getMpPayments().cancel({ id: row.providerRef });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (row.provider !== "cash") providerCancelFailures.push({ paymentId: row.id, provider: row.provider, message });
      console.warn("[payments] no se pudo anular el cobro en el proveedor", { paymentId: row.id, message });
    }
  }

  return { expired: rows.map((r) => r.id), providerCancelFailures };
}
