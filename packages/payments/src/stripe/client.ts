import Stripe from "stripe";

import { requireEnv } from "../env";

let _stripe: Stripe | undefined;

/**
 * Cliente Stripe perezoso. `createFetchHttpClient()` es obligatorio en Vercel
 * serverless (el http client por defecto de Node falla en ese runtime).
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  _stripe = new Stripe(requireEnv("stripe", "STRIPE_SECRET_KEY"), {
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: { name: "Granola", url: "https://granola.app" },
  });
  return _stripe;
}

export type { Stripe };
