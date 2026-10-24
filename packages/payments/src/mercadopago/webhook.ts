import { db, eq, payments } from "@granola/db";
import { z } from "zod";

import { requireEnv } from "../env";
import { WebhookSignatureError } from "../errors";
import { mapMercadoPagoStatus } from "../status";
import { applyPaymentTransition, type ConfirmedEvent } from "../transitions";
import { getMpPayments } from "./client";
import { extractMpInstructions, type MpInstructions, type PaymentResponse } from "./instructions";
import { verifyMpSignature, type MpSignatureParts } from "./signature";

/**
 * Cuerpo de la notificación de MP (formato Webhooks v2). Solo nos importa
 * `type === "payment"` + `data.id`; el resto (merchant_order, plan…) se ignora.
 * El formato IPN viejo manda `topic` y `resource`; también lo aceptamos.
 */
export const mpNotificationSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    type: z.string().optional(),
    topic: z.string().optional(),
    action: z.string().optional(),
    live_mode: z.boolean().optional(),
    data: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
    resource: z.string().optional(),
  })
  .loose();

export type MpNotification = z.infer<typeof mpNotificationSchema>;

/** Extrae el id de pago de la notificación (body v2, body IPN o query `data.id`). */
export function mpPaymentIdFrom(body: MpNotification, queryDataId: string | null): string | null {
  if (body.data?.id !== undefined) return String(body.data.id);
  if (queryDataId) return queryDataId;
  if (body.resource) {
    const m = /\/v1\/payments\/(\d+)/.exec(body.resource) ?? /^(\d+)$/.exec(body.resource);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function isMpPaymentNotification(body: MpNotification): boolean {
  return body.type === "payment" || body.topic === "payment";
}

export function assertMpSignature(parts: MpSignatureParts): void {
  const secret = requireEnv("mercadopago", "MP_WEBHOOK_SECRET");
  const result = verifyMpSignature(parts, secret);
  if (!result.valid) throw new WebhookSignatureError("mercadopago", result.reason);
}

export type MpWebhookOutcome =
  | { kind: "ignored"; reason: "not_payment" | "no_id" }
  | { kind: "payment"; mpPaymentId: string; mpStatus: string | null; applied: boolean; reason?: string; confirmed: ConfirmedEvent | null };

export type MpWebhookDeps = {
  onAppointmentConfirmed: (data: ConfirmedEvent) => Promise<void>;
  /** Inyectable en tests; por defecto consulta la API de MP. */
  fetchPayment?: (id: string) => Promise<PaymentResponse>;
};

/**
 * MP no manda el estado en el webhook: hay que consultar `GET /v1/payments/{id}`
 * (y así la notificación no puede falsificar un `approved`).
 */
export async function handleMercadoPagoNotification(
  body: MpNotification,
  queryDataId: string | null,
  deps: MpWebhookDeps,
): Promise<MpWebhookOutcome> {
  if (!isMpPaymentNotification(body)) return { kind: "ignored", reason: "not_payment" };
  const mpPaymentId = mpPaymentIdFrom(body, queryDataId);
  if (!mpPaymentId) return { kind: "ignored", reason: "no_id" };

  const fetchPayment = deps.fetchPayment ?? ((id: string) => getMpPayments().get({ id }));
  const mp = await fetchPayment(mpPaymentId);

  const next = mapMercadoPagoStatus(mp.status, mp.status_detail);
  const result = await applyPaymentTransition(mpPaymentId, next);
  if (!result.applied) {
    return { kind: "payment", mpPaymentId, mpStatus: mp.status ?? null, applied: false, reason: result.reason, confirmed: null };
  }
  if (result.confirmed) await deps.onAppointmentConfirmed(result.confirmed);
  return { kind: "payment", mpPaymentId, mpStatus: mp.status ?? null, applied: true, confirmed: result.confirmed };
}

/**
 * Para la página /pago/[paymentId]: busca el pago en nuestra DB (provider
 * mercadopago) y pide a MP los datos de la CLABE/referencia.
 */
export async function getMpInstructionsForPayment(paymentId: string): Promise<
  | { ok: true; payment: typeof payments.$inferSelect; instructions: MpInstructions | null }
  | { ok: false; reason: "not_found" | "not_mercadopago" | "no_provider_ref" }
> {
  const payment = await db.query.payments.findFirst({ where: eq(payments.id, paymentId) });
  if (!payment) return { ok: false, reason: "not_found" };
  if (payment.provider !== "mercadopago") return { ok: false, reason: "not_mercadopago" };
  if (!payment.providerRef) return { ok: false, reason: "no_provider_ref" };
  const mp = await getMpPayments().get({ id: payment.providerRef });
  return { ok: true, payment, instructions: extractMpInstructions(mp) };
}
