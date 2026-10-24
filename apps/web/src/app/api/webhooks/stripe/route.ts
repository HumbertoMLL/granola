import { NextResponse, type NextRequest } from "next/server";

import {
  constructStripeEvent,
  handleStripeEvent,
  PaymentsNotConfiguredError,
  WebhookSignatureError,
} from "@granola/payments";

import { sendEvent } from "@/lib/inngest-client";

/**
 * Webhook de Stripe (cuenta plataforma). Configurar en el dashboard:
 *   URL:     https://<dominio>/api/webhooks/stripe
 *   Eventos: checkout.session.completed, checkout.session.async_payment_succeeded,
 *            checkout.session.async_payment_failed, checkout.session.expired,
 *            account.updated (este último viene del listener "Connect")
 *
 * Idempotente: `applyPaymentTransition` no re-marca un pago ya `paid`
 * (providerRef = session.id es único en `payments`).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let event;
  try {
    event = await constructStripeEvent(rawBody, req.headers.get("stripe-signature"));
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof PaymentsNotConfiguredError) {
      console.error("[webhooks/stripe]", err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }

  let eventSent: boolean | null = null;
  const outcome = await handleStripeEvent(event, {
    onAppointmentConfirmed: async (data) => {
      eventSent = await sendEvent({ name: "appointment/confirmed", data });
      if (!eventSent) console.error("[webhooks/stripe] appointment/confirmed no se pudo emitir", data);
    },
  });

  if (outcome.kind === "account") {
    console.info("[webhooks/stripe] account.updated", {
      nutritionistId: outcome.nutritionistId,
      chargesEnabled: outcome.status.chargesEnabled,
      payoutsEnabled: outcome.status.payoutsEnabled,
      currentlyDue: outcome.status.currentlyDue,
    });
  }

  return NextResponse.json({ received: true, eventId: event.id, outcome, eventSent });
}
