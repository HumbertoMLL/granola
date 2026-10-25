import "server-only";

import { headers } from "next/headers";

/**
 * Origen público de la app, sin "/" final (Twelve-Factor III: nada hardcodeado).
 * Orden: NEXT_PUBLIC_APP_URL → BETTER_AUTH_URL → host del request actual.
 */
export async function getAppUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
