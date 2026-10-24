import { PaymentsNotConfiguredError } from "./errors";

/** Lee una env var obligatoria del proveedor; lanza PaymentsNotConfiguredError si falta. */
export function requireEnv(provider: "stripe" | "mercadopago", name: string): string {
  const value = process.env[name];
  if (!value) throw new PaymentsNotConfiguredError(provider, name);
  return value;
}

/** Origen público de la app (sin slash final). Se usa para webhooks, return/refresh URLs y /pago/[id]. */
export function appUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function isMercadoPagoConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}
