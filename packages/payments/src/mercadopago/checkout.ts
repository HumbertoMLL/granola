import { db, eq, payments } from "@granola/db";

import { appUrl } from "../env";
import { PaymentsError } from "../errors";
import type { CreateCheckoutInput, CreateCheckoutResult } from "../types";
import { getMpPayments } from "./client";
import { extractMpInstructions } from "./instructions";

/**
 * Expiraciones:
 * - SPEI 24 h: la transferencia es inmediata; si el paciente no paga el mismo
 *   día casi nunca paga, y así liberamos el slot de la agenda pronto.
 * - OXXO 48 h: hay que ir físicamente a la tienda; 24 h deja fuera a quien
 *   agenda de noche. MP permite hasta 30 días, pero bloquear un slot tanto
 *   tiempo sin pagar perjudica al nutri.
 * Si la cita empieza antes que la expiración, el booking debería acortarla
 * (TODO en booking: pasar `expiresAt` opcional; el tipo lo permite).
 */
export const MP_EXPIRATION_MS = {
  spei: 24 * 60 * 60 * 1000,
  oxxo: 48 * 60 * 60 * 1000,
} as const;

const PAYMENT_METHOD_ID = { spei: "clabe", oxxo: "oxxo" } as const;

/**
 * MP exige `payer.email`. Si el paciente solo dejó WhatsApp, generamos
 * `${digits}@sin-correo.granola.app` — dominio nuestro, así los correos que MP
 * intente mandar rebotan en un buzón que controlamos y no en el de un tercero.
 */
export function payerEmailFor(payer: CreateCheckoutInput["payer"]): string {
  if (payer.email) return payer.email;
  const digits = (payer.phone ?? "").replace(/\D/g, "");
  if (!digits) {
    throw new PaymentsError("payer_contact_required", "Mercado Pago necesita email o teléfono del paciente");
  }
  return `${digits}@sin-correo.granola.app`;
}

/** MP formatea `date_of_expiration` como ISO con offset, sin la "Z" (p. ej. 2026-10-25T12:00:00.000-06:00). */
export function formatMpDate(d: Date): string {
  // Siempre en UTC con offset explícito +00:00 (regla dura #6: fechas en UTC).
  return d.toISOString().replace("Z", "+00:00");
}

function splitName(name: string): { first_name: string; last_name: string } {
  const parts = name.trim().split(/\s+/);
  const first = parts.shift() ?? "Paciente";
  return { first_name: first, last_name: parts.join(" ") || "." };
}

/**
 * Pago directo (`POST /v1/payments`) con `payment_method_id` "clabe" (SPEI) u
 * "oxxo". No usamos Checkout Pro porque queremos la CLABE/referencia en
 * nuestra propia página y mandarla por WhatsApp (plantilla `pago_pendiente_oxxo`).
 */
export async function createMercadoPagoCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
  if (input.method !== "spei" && input.method !== "oxxo") {
    throw new PaymentsError("unsupported_method", `Mercado Pago solo maneja SPEI/OXXO, no ${input.method}`);
  }
  const method = input.method;
  const expiresAt = new Date(Date.now() + MP_EXPIRATION_MS[method]);

  // 1) Row pending primero: el paymentId es el external_reference.
  const [payment] = await db
    .insert(payments)
    .values({
      appointmentId: input.appointmentId,
      provider: "mercadopago",
      method,
      status: "pending",
      amountCents: input.amountCents,
      currency: input.currency,
      expiresAt,
    })
    .returning();
  if (!payment) throw new PaymentsError("insert_failed", "No se pudo crear el registro de pago");

  const base = appUrl();
  const mp = await getMpPayments().create({
    body: {
      transaction_amount: input.amountCents / 100,
      description: input.description,
      payment_method_id: PAYMENT_METHOD_ID[method],
      payer: { email: payerEmailFor(input.payer), ...splitName(input.payer.name) },
      external_reference: payment.id,
      notification_url: `${base}/api/webhooks/mercadopago`,
      date_of_expiration: formatMpDate(expiresAt),
      metadata: {
        appointment_id: input.appointmentId,
        payment_id: payment.id,
        nutritionist_id: input.nutritionistId,
      },
      // Statement del paciente: nombre del servicio, no "Granola".
      statement_descriptor: input.description.slice(0, 22),
    },
    requestOptions: { idempotencyKey: `mp:${payment.id}` },
  });

  if (mp.id === undefined) throw new PaymentsError("mp_no_id", "Mercado Pago no devolvió id de pago");
  const providerRef = String(mp.id);

  // 2) providerRef ANTES de devolver (regla dura #3).
  await db
    .update(payments)
    .set({ providerRef, updatedAt: new Date() })
    .where(eq(payments.id, payment.id));

  const instructions = extractMpInstructions(mp);
  // OXXO: la ficha de MP ya trae código de barras y monto. SPEI: página propia con la CLABE.
  const url =
    method === "oxxo" && instructions?.ticketUrl ? instructions.ticketUrl : `${base}/pago/${payment.id}`;

  return {
    provider: "mercadopago",
    paymentId: payment.id,
    url,
    expiresAt: instructions?.expiresAt ?? expiresAt,
  };
}
