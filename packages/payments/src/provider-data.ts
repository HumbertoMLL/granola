/**
 * Mapeo puro entre las respuestas de los proveedores y `payments.provider_data`
 * (jsonb). Sin IO: testeable. Ver `PaymentProviderData` en @granola/db.
 */
import type { PaymentProviderData } from "@granola/db/schema";

import type { MpInstructions } from "./mercadopago/instructions";
import type { PaymentStatus } from "./status";

/** De las instrucciones normalizadas de MP (CLABE, referencia, ficha…) a provider_data. */
export function mpInstructionsToProviderData(instructions: MpInstructions): PaymentProviderData {
  return {
    providerId: instructions.mpPaymentId,
    clabe: instructions.clabe,
    bankName: instructions.bankName,
    reference: instructions.reference,
    ticketUrl: instructions.ticketUrl,
    barcodeBase64: instructions.barcodeBase64,
    providerStatus: instructions.status,
    providerStatusDetail: instructions.statusDetail,
  };
}

/** Datos mínimos de una Checkout Session de Stripe que guardamos. */
export function stripeSessionToProviderData(session: {
  id: string;
  url: string | null;
  payment_intent?: string | { id: string } | null;
  status?: string | null;
}): PaymentProviderData {
  const pi = session.payment_intent;
  return {
    providerId: session.id,
    sessionUrl: session.url,
    paymentIntentId: typeof pi === "string" ? pi : (pi?.id ?? null),
    providerStatus: session.status ?? null,
  };
}

/** `{}` (default de la columna) o sin datos de pago útiles. */
export function isProviderDataEmpty(data: PaymentProviderData | null | undefined): boolean {
  if (!data) return true;
  return !data.clabe && !data.reference && !data.ticketUrl && !data.barcodeBase64 && !data.sessionUrl;
}

/**
 * Reconstruye `MpInstructions` desde lo guardado, para que /pago/[id] no
 * consulte a MP. Devuelve null si no hay datos suficientes (→ consultar a MP).
 */
export function providerDataToMpInstructions(payment: {
  method: "card" | "spei" | "oxxo" | "cash";
  providerRef: string | null;
  amountCents: number;
  expiresAt: Date | null;
  providerData: PaymentProviderData | null;
}): MpInstructions | null {
  const data = payment.providerData;
  if (payment.method !== "spei" && payment.method !== "oxxo") return null;
  if (!data || isProviderDataEmpty(data)) return null;
  // SPEI sin CLABE u OXXO sin referencia ni ficha no sirven al paciente.
  if (payment.method === "spei" && !data.clabe) return null;
  if (payment.method === "oxxo" && !data.reference && !data.ticketUrl) return null;
  return {
    mpPaymentId: data.providerId ?? payment.providerRef ?? "",
    method: payment.method,
    status: data.providerStatus ?? null,
    statusDetail: data.providerStatusDetail ?? null,
    amountCents: payment.amountCents,
    expiresAt: payment.expiresAt,
    ticketUrl: data.ticketUrl ?? null,
    clabe: data.clabe ?? null,
    bankName: data.bankName ?? null,
    reference: data.reference ?? null,
    barcodeBase64: data.barcodeBase64 ?? null,
  };
}

/**
 * Texto corto para `payments.failure_reason` cuando un pago pasa a
 * `failed`/`expired`. null para cualquier otro estado.
 */
export function failureReasonFor(
  next: PaymentStatus | null,
  source:
    | { provider: "mercadopago"; status?: string | null; statusDetail?: string | null }
    | { provider: "stripe"; eventType: string }
    | { provider: "system"; reason: string },
): string | null {
  if (next !== "failed" && next !== "expired") return null;
  switch (source.provider) {
    case "mercadopago": {
      const detail = source.statusDetail || source.status || null;
      return detail ? `mp:${detail}` : next === "expired" ? "mp:expired" : "mp:failed";
    }
    case "stripe":
      return source.eventType === "checkout.session.expired"
        ? "stripe:session_expired"
        : source.eventType === "checkout.session.async_payment_failed"
          ? "stripe:async_payment_failed"
          : `stripe:${source.eventType}`;
    case "system":
      return source.reason;
  }
}
