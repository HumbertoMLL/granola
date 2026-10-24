/**
 * Decisión pura (sin IO) de qué pasa con una reserva después de intentar el
 * cobro: status final de la cita, evento Inngest a emitir y a dónde redirigir.
 * `createBooking` (actions.ts) ejecuta lo que esto decide. Tests en outcome.test.ts.
 *
 * No importa @granola/payments para seguir siendo puro: los errores se
 * clasifican por `name`/`code` (mismo contrato que PaymentsError /
 * PaymentsNotConfiguredError; el test lo verifica con las clases reales).
 */

export type PaymentMode = "prepaid" | "at_visit" | "optional";
export type CheckoutMethod = "card" | "spei" | "oxxo";

/** Valor de `?pago=` en /[slug]/agendar/listo. */
export type ListoPago = "ok" | "pendiente" | "consulta";

/** Lo que devolvió (o lanzó) `createCheckout()`; null si el servicio no es prepagado. */
export type CheckoutAttempt =
  | {
      ok: true;
      method: CheckoutMethod;
      result: { paymentId: string; url: string; expiresAt?: Date };
    }
  | { ok: false; error: unknown }
  | null;

export type BookingOutcomeInput = {
  slug: string;
  cancelToken: string;
  paymentMode: PaymentMode;
  startsAt: Date;
  now: Date;
  checkout: CheckoutAttempt;
};

export type BookingOutcome =
  | {
      kind: "confirmed";
      finalStatus: "confirmed";
      emit: { name: "appointment/confirmed" };
      redirectTo: string;
      /** true si era prepagado pero se degradó a "paga en consulta". */
      degraded: boolean;
    }
  | {
      kind: "awaiting_payment";
      finalStatus: "pending_payment";
      emit: { name: "appointment/pending_payment"; expiresAt: string };
      redirectTo: string;
      /** Tarjeta → Checkout de Stripe (externo). SPEI/OXXO → /listo?pago=pendiente. */
      external: boolean;
    }
  | { kind: "failed"; deleteAppointment: true; error: string };

/** Sesión de Checkout de Stripe: 1 h (igual que CARD_SESSION_TTL_MS en @granola/payments). */
export const CARD_PAYMENT_TTL_MS = 60 * 60 * 1000;

export const CHECKOUT_FAILED_ERROR = "No pudimos iniciar el pago. Intenta de nuevo o elige otra forma de pago.";

/** Status con el que se inserta la cita antes de cobrar. */
export function initialAppointmentStatus(paymentMode: PaymentMode): "pending_payment" | "confirmed" {
  return paymentMode === "prepaid" ? "pending_payment" : "confirmed";
}

export function listoPath(slug: string, cancelToken: string, pago?: ListoPago): string {
  const base = `/${slug}/agendar/listo?cita=${encodeURIComponent(cancelToken)}`;
  return pago ? `${base}&pago=${pago}` : base;
}

/**
 * true si el error significa "esta nutri aún no puede cobrar en línea" (no
 * conectó Stripe, o faltan keys del proveedor) → la cita se confirma y se paga
 * en consulta. Cualquier otro error es fatal para la reserva.
 */
export function isPaymentsUnavailableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: unknown; code?: unknown };
  if (e.name === "PaymentsNotConfiguredError") return true;
  return e.name === "PaymentsError" && e.code === "stripe_not_connected";
}

export function decideBookingOutcome(input: BookingOutcomeInput): BookingOutcome {
  const { slug, cancelToken, paymentMode, checkout } = input;

  if (paymentMode !== "prepaid" || checkout === null) {
    return {
      kind: "confirmed",
      finalStatus: "confirmed",
      emit: { name: "appointment/confirmed" },
      redirectTo: listoPath(slug, cancelToken),
      degraded: false,
    };
  }

  if (!checkout.ok) {
    if (isPaymentsUnavailableError(checkout.error)) {
      return {
        kind: "confirmed",
        finalStatus: "confirmed",
        emit: { name: "appointment/confirmed" },
        redirectTo: listoPath(slug, cancelToken, "consulta"),
        degraded: true,
      };
    }
    return { kind: "failed", deleteAppointment: true, error: CHECKOUT_FAILED_ERROR };
  }

  const { method, result } = checkout;
  const providerExpiry =
    result.expiresAt ?? (method === "card" ? new Date(input.now.getTime() + CARD_PAYMENT_TTL_MS) : null);
  // Sin expiración del proveedor (no debería pasar en SPEI/OXXO) usamos la de tarjeta.
  const rawExpiry = providerExpiry ?? new Date(input.now.getTime() + CARD_PAYMENT_TTL_MS);
  // El slot se libera a más tardar cuando empieza la cita: no tiene caso esperar un pago después.
  const expiresAt = rawExpiry.getTime() > input.startsAt.getTime() ? input.startsAt : rawExpiry;

  const external = method === "card";
  return {
    kind: "awaiting_payment",
    finalStatus: "pending_payment",
    emit: { name: "appointment/pending_payment", expiresAt: expiresAt.toISOString() },
    redirectTo: external ? result.url : listoPath(slug, cancelToken, "pendiente"),
    external,
  };
}
