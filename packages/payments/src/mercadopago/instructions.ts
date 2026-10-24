import type { Payment } from "mercadopago";

/** Respuesta de /v1/payments tal como la tipa el SDK (sin depender de rutas internas del paquete). */
export type PaymentResponse = Awaited<ReturnType<Payment["get"]>>;

/**
 * Datos que el paciente necesita para pagar, normalizados desde la respuesta
 * de /v1/payments. Se usan en la página pública /pago/[paymentId].
 *
 * Hasta que exista `payments.provider_data jsonb` esto se recalcula consultando
 * a MP por `providerRef` cada vez que se abre la página.
 */
export type MpInstructions = {
  mpPaymentId: string;
  method: "spei" | "oxxo";
  status: string | null;
  statusDetail: string | null;
  amountCents: number;
  expiresAt: Date | null;
  /** Comprobante/ficha imprimible de MP (OXXO siempre; SPEI a veces). */
  ticketUrl: string | null;
  /** SPEI: CLABE a la que transferir. */
  clabe: string | null;
  /** SPEI: banco receptor; OXXO: referencia de pago. */
  bankName: string | null;
  reference: string | null;
  /** OXXO: código de barras en base64 (si MP lo devuelve). */
  barcodeBase64: string | null;
};

type Loose = Record<string, unknown>;
const obj = (v: unknown): Loose => (v && typeof v === "object" ? (v as Loose) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : typeof v === "number" ? String(v) : null);

export function toCents(amount: number | undefined | null): number {
  return Math.round((amount ?? 0) * 100);
}

/** Convierte el método de MP a nuestro `CheckoutMethod`. */
export function mpMethodFrom(paymentMethodId: string | undefined | null): "spei" | "oxxo" | null {
  if (paymentMethodId === "clabe") return "spei";
  if (paymentMethodId === "oxxo") return "oxxo";
  return null;
}

export function extractMpInstructions(payment: PaymentResponse): MpInstructions | null {
  const method = mpMethodFrom(payment.payment_method_id);
  if (!method || payment.id === undefined) return null;

  const details = obj(payment.transaction_details);
  const poi = obj(payment.point_of_interaction);
  const txData = obj(poi.transaction_data);
  const bankInfo = obj(txData.bank_info);
  const collector = obj(bankInfo.collector);

  const ticketUrl = str(txData.ticket_url) ?? str(details.external_resource_url);
  const reference = str(details.payment_method_reference_id);

  return {
    mpPaymentId: String(payment.id),
    method,
    status: payment.status ?? null,
    statusDetail: payment.status_detail ?? null,
    amountCents: toCents(payment.transaction_amount),
    expiresAt: payment.date_of_expiration ? new Date(payment.date_of_expiration) : null,
    ticketUrl,
    // Para "clabe" MP regresa la CLABE en payment_method_reference_id; para OXXO ese
    // campo es la referencia numérica del voucher.
    clabe: method === "spei" ? reference : null,
    bankName: str(collector.long_name) ?? str(details.financial_institution),
    reference: method === "oxxo" ? reference : null,
    // `barcode` no está en los tipos del SDK pero MP lo devuelve para OXXO.
    barcodeBase64: str(obj((payment as unknown as Loose).barcode).content) ?? null,
  };
}
