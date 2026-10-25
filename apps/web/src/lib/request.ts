import "server-only";

import { headers } from "next/headers";

/** IP del request (x-forwarded-for, luego x-real-ip) para `consent_ip` y `audit_log.ip`. */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || h.get("x-real-ip") || "unknown";
}
