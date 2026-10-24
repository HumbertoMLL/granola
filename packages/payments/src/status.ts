/**
 * Mapeo puro de estados de proveedor → `payments.status`. Sin IO: testeable.
 *
 * Decisión: las expiraciones (sesión de Stripe vencida, SPEI/OXXO sin pagar)
 * se guardan como `expired`, no `failed`, porque el enum ya lo tiene y al nutri
 * le sirve distinguir "no pagó a tiempo" de "el banco lo rechazó".
 */
export type PaymentStatus = "pending" | "paid" | "failed" | "expired" | "refunded";

/** Resultado del mapeo: a qué estado pasar, o `null` si el evento no cambia nada. */
export type StatusTransition = PaymentStatus | null;

// ───────────── Stripe ─────────────

export type StripeCheckoutEventType =
  | "checkout.session.completed"
  | "checkout.session.async_payment_succeeded"
  | "checkout.session.async_payment_failed"
  | "checkout.session.expired";

export type StripeSessionPaymentStatus = "paid" | "unpaid" | "no_payment_required";

/**
 * `checkout.session.completed` llega también para métodos asíncronos (OXXO de
 * Stripe, etc.) con `payment_status: "unpaid"`; en ese caso no marcamos nada y
 * esperamos `async_payment_succeeded`. Hoy solo usamos tarjeta, pero el mapeo
 * queda correcto para no marcar `paid` sin dinero.
 */
export function mapStripeEvent(
  type: string,
  paymentStatus: StripeSessionPaymentStatus | string | null | undefined,
): StatusTransition {
  switch (type) {
    case "checkout.session.completed":
      return paymentStatus === "paid" || paymentStatus === "no_payment_required" ? "paid" : null;
    case "checkout.session.async_payment_succeeded":
      return "paid";
    case "checkout.session.async_payment_failed":
      return "failed";
    case "checkout.session.expired":
      return "expired";
    default:
      return null;
  }
}

// ───────────── Mercado Pago ─────────────

/** Estados documentados de /v1/payments. */
export type MpPaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

/**
 * `cancelled` con `status_detail: "expired"` es como MP reporta un SPEI/OXXO
 * que venció sin pagarse (no existe status "expired" a nivel top).
 */
export function mapMercadoPagoStatus(
  status: MpPaymentStatus | string | null | undefined,
  statusDetail?: string | null,
): StatusTransition {
  switch (status) {
    case "approved":
      return "paid";
    case "rejected":
      return "failed";
    case "cancelled":
      return statusDetail === "expired" ? "expired" : "failed";
    case "refunded":
    case "charged_back":
      return "refunded";
    case "pending":
    case "in_process":
    case "authorized":
    case "in_mediation":
      return null;
    default:
      return null;
  }
}

/**
 * Idempotencia (regla dura #3): un pago `paid` nunca retrocede, y un estado
 * terminal no se reprocesa. Devuelve `true` si hay que aplicar la transición.
 */
export function shouldApplyTransition(current: PaymentStatus, next: StatusTransition): boolean {
  if (next === null) return false;
  if (current === next) return false;
  if (current === "paid") return next === "refunded";
  if (current === "refunded") return false;
  // pending | failed | expired → cualquier otro. (failed→paid pasa si MP reintenta y aprueba.)
  return true;
}
