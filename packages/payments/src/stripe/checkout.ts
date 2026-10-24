import { db, eq, nutritionists, payments } from "@granola/db";

import { PaymentsError } from "../errors";
import { stripeSessionToProviderData } from "../provider-data";
import type { CreateCheckoutInput, CreateCheckoutResult } from "../types";
import { getStripe } from "./client";

/** Stripe expira sesiones de Checkout entre 30 min y 24 h. Para tarjeta, 1 h basta. */
const CARD_SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * Checkout con tarjeta vía **destination charge**:
 *
 *   payment_intent_data.transfer_data.destination = acct del nutri
 *   application_fee_amount = 0
 *
 * Por qué destination y no direct charge (header `Stripe-Account`):
 * - El webhook, la sesión y el PaymentIntent viven en la cuenta de Granola →
 *   un solo endpoint de webhooks, un solo secret, y podemos consultar el pago
 *   sin pasar `stripeAccount` en cada llamada.
 * - Reembolsos y disputas se gestionan desde la plataforma (soporte centralizado).
 * - Con `application_fee_amount: 0` y `on_behalf_of` el nutri aparece como
 *   merchant of record y absorbe la comisión de Stripe; Granola no se queda nada.
 *   (Direct charges tendrían el mismo efecto económico pero obligan a
 *   onboarding de capabilities por cuenta y webhooks `Connect` separados.)
 */
export async function createStripeCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult> {
  if (input.method !== "card") {
    throw new PaymentsError("unsupported_method", `Stripe solo maneja tarjeta, no ${input.method}`);
  }

  const nutri = await db.query.nutritionists.findFirst({
    where: eq(nutritionists.id, input.nutritionistId),
    columns: { id: true, stripeAccountId: true, displayName: true },
  });
  if (!nutri) throw new PaymentsError("nutritionist_not_found", "Nutriólogo/a no encontrado");
  if (!nutri.stripeAccountId) {
    throw new PaymentsError(
      "stripe_not_connected",
      `${nutri.displayName} aún no conectó Stripe; no se puede cobrar con tarjeta.`,
    );
  }

  // 1) Row `pending` sin providerRef: así el paymentId existe antes de hablar con Stripe
  //    y viaja en metadata. Si Stripe falla, queda un pending huérfano sin providerRef
  //    que el filtro de la tabla ignora (y se puede limpiar con un cron).
  const [payment] = await db
    .insert(payments)
    .values({
      appointmentId: input.appointmentId,
      provider: "stripe",
      method: "card",
      status: "pending",
      amountCents: input.amountCents,
      currency: input.currency,
      expiresAt: new Date(Date.now() + CARD_SESSION_TTL_MS),
    })
    .returning();
  if (!payment) throw new PaymentsError("insert_failed", "No se pudo crear el registro de pago");

  const metadata = {
    appointmentId: input.appointmentId,
    paymentId: payment.id,
    nutritionistId: input.nutritionistId,
  };

  const session = await getStripe().checkout.sessions.create(
    {
      mode: "payment",
      payment_method_types: ["card"],
      currency: "mxn",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mxn",
            unit_amount: input.amountCents,
            product_data: { name: input.description },
          },
        },
      ],
      customer_email: input.payer.email,
      metadata,
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: { destination: nutri.stripeAccountId },
        on_behalf_of: nutri.stripeAccountId,
        description: input.description,
        metadata,
      },
      expires_at: Math.floor((Date.now() + CARD_SESSION_TTL_MS) / 1000),
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      locale: "es-419",
    },
    // Idempotencia del lado de Stripe: reintentar la misma reserva no duplica sesiones.
    { idempotencyKey: `checkout:${payment.id}` },
  );

  if (!session.url) throw new PaymentsError("no_session_url", "Stripe no devolvió URL de Checkout");

  // 2) providerRef = session.id (+ provider_data con la URL de la sesión) ANTES de devolver la URL (regla dura #3).
  await db
    .update(payments)
    .set({
      providerRef: session.id,
      providerData: stripeSessionToProviderData(session),
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id));

  return {
    provider: "stripe",
    paymentId: payment.id,
    url: session.url,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
  };
}
