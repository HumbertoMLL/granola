import { redirect } from "next/navigation";

import { appUrl, createOnboardingLink, PaymentsNotConfiguredError } from "@granola/payments";

import { requireNutritionist } from "@/lib/session";

/**
 * `refresh_url` del onboarding: Stripe manda aquí cuando el link caducó o el
 * usuario recargó. Generamos uno nuevo para SU cuenta (sesión obligatoria) y
 * lo mandamos de vuelta a Stripe.
 */
export async function GET() {
  const { nutritionist } = await requireNutritionist();
  if (!nutritionist.stripeAccountId) redirect("/app/cobros?stripe=missing");

  const base = appUrl();
  let url: string;
  try {
    url = await createOnboardingLink(
      nutritionist.stripeAccountId,
      `${base}/api/connect/stripe/return`,
      `${base}/api/connect/stripe/refresh`,
    );
  } catch (err) {
    if (err instanceof PaymentsNotConfiguredError) redirect("/app/cobros?stripe=not_configured");
    throw err;
  }
  // Fuera del try: redirect() lanza NEXT_REDIRECT y no debe caer en el catch.
  redirect(url);
}
