/**
 * @granola/payments — Stripe Connect (tarjeta) + Mercado Pago (SPEI/OXXO) + efectivo.
 *
 * CONTRATO: el flujo de reserva (booking) llama createCheckout() y redirige al
 * `url` devuelto. Los webhooks (stripe/mercadopago) marcan el pago y emiten
 * `appointment/confirmed`. Implementación en ./stripe y ./mercadopago.
 */
import { createMercadoPagoCheckout } from "./mercadopago/checkout";
import { createStripeCheckout } from "./stripe/checkout";
import type { CreateCheckoutInput, CreateCheckoutResult } from "./types";

export type { CheckoutMethod, CheckoutProvider, CreateCheckoutInput, CreateCheckoutResult } from "./types";

/** Qué proveedor atiende cada método. Puro, para que booking pueda decidir sin llamar a nadie. */
export function providerForMethod(method: CreateCheckoutInput["method"]): CreateCheckoutResult["provider"] {
  return method === "card" ? "stripe" : "mercadopago";
}

/**
 * Crea el cobro e inserta la fila `payments` (status pending, providerRef del
 * proveedor) ANTES de devolver la URL a la que hay que redirigir al paciente.
 *
 * - card  → Stripe Checkout Session (destination charge al acct del nutri).
 * - spei  → Mercado Pago pago directo `clabe`; url = /pago/[paymentId] (CLABE propia).
 * - oxxo  → Mercado Pago pago directo `oxxo`; url = ticket de MP.
 *
 * Lanza `PaymentsNotConfiguredError` si faltan keys, `PaymentsError` si el
 * nutri no conectó Stripe, etc. Booking decide cómo mostrar el error.
 */
export async function createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error(`createCheckout: amountCents debe ser entero positivo (recibido ${input.amountCents})`);
  }
  return providerForMethod(input.method) === "stripe"
    ? createStripeCheckout(input)
    : createMercadoPagoCheckout(input);
}

export { PaymentsError, PaymentsNotConfiguredError, WebhookSignatureError } from "./errors";
export { appUrl, isMercadoPagoConfigured, isStripeConfigured } from "./env";
export {
  mapMercadoPagoStatus,
  mapStripeEvent,
  shouldApplyTransition,
  type MpPaymentStatus,
  type PaymentStatus,
  type StatusTransition,
} from "./status";
export {
  applyPaymentTransition,
  type ApplyTransitionResult,
  type ConfirmedEvent,
  type PaymentRow,
  type TransitionExtras,
} from "./transitions";
export {
  failureReasonFor,
  isProviderDataEmpty,
  mpInstructionsToProviderData,
  providerDataToMpInstructions,
  stripeSessionToProviderData,
} from "./provider-data";
export {
  APPOINTMENT_EXPIRED_REASON,
  expirePendingPaymentsForAppointment,
  type ExpirePendingPaymentsResult,
} from "./expire";
export { markCashPaid } from "./cash";
export {
  listPaymentsForMonth,
  listUnpaidVisitAppointments,
  monthRange,
  summarizeMonth,
  type MonthSummary,
  type PaymentListItem,
  type UnpaidVisitAppointment,
} from "./queries";

export * from "./stripe";
export * from "./mercadopago";
