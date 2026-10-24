import { db, eq, nutritionists } from "@granola/db";

import { requireEnv } from "../env";
import { WebhookSignatureError } from "../errors";
import { mapStripeEvent } from "../status";
import { applyPaymentTransition, type ConfirmedEvent } from "../transitions";
import { getStripe, type Stripe } from "./client";
import { accountToStatus, type ConnectAccountStatus } from "./connect";

/**
 * Verifica la firma (`Stripe-Signature`) con STRIPE_WEBHOOK_SECRET y devuelve
 * el evento tipado. `rawBody` debe ser el cuerpo sin parsear (`await req.text()`).
 * Usamos la variante async porque en Vercel/edge solo hay Web Crypto.
 */
export async function constructStripeEvent(rawBody: string, signature: string | null): Promise<Stripe.Event> {
  if (!signature) throw new WebhookSignatureError("stripe", "falta header Stripe-Signature");
  const secret = requireEnv("stripe", "STRIPE_WEBHOOK_SECRET");
  try {
    return await getStripe().webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (err) {
    throw new WebhookSignatureError("stripe", err instanceof Error ? err.message : String(err));
  }
}

export type StripeWebhookOutcome =
  | { kind: "ignored"; type: string }
  | { kind: "payment"; type: string; applied: boolean; reason?: string; confirmed: ConfirmedEvent | null }
  | { kind: "account"; type: string; nutritionistId: string | null; status: ConnectAccountStatus };

export type StripeWebhookDeps = {
  /** Emite `appointment/confirmed` (inngest.send en apps/web). */
  onAppointmentConfirmed: (data: ConfirmedEvent) => Promise<void>;
};

/**
 * Procesa un evento ya verificado. Idempotente vía `applyPaymentTransition`
 * (providerRef único = session.id). Devuelve qué hizo para loggear en el route.
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  deps: StripeWebhookDeps,
): Promise<StripeWebhookOutcome> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object;
      const next = mapStripeEvent(event.type, session.payment_status);
      const result = await applyPaymentTransition(session.id, next);
      if (!result.applied) {
        return { kind: "payment", type: event.type, applied: false, reason: result.reason, confirmed: null };
      }
      if (result.confirmed) await deps.onAppointmentConfirmed(result.confirmed);
      return { kind: "payment", type: event.type, applied: true, confirmed: result.confirmed };
    }

    case "account.updated": {
      // TODO(schema): no hay columnas para persistir charges_enabled / requirements
      // (ver README "Columnas que faltan"). Por ahora el panel consulta el estado en vivo
      // y aquí solo confirmamos que la cuenta es de un nutri conocido.
      const account = event.data.object;
      const status = accountToStatus(account);
      const nutri = await db.query.nutritionists.findFirst({
        where: eq(nutritionists.stripeAccountId, account.id),
        columns: { id: true },
      });
      return { kind: "account", type: event.type, nutritionistId: nutri?.id ?? null, status };
    }

    default:
      return { kind: "ignored", type: event.type };
  }
}
