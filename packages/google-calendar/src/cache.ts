import { createHash } from "node:crypto";
import { createGoogleCalendarClient, GoogleCalendarError, type BusyInterval } from "./client";

const TTL = 60_000;
const DAY = 86_400_000;
// Caché descartable por instancia: nunca fuente de verdad ni persistencia de tokens.
const cache = new Map<string, { expiresAt: number; value: Promise<BusyInterval[]> }>();
export function clearCalendarBusyCache(nutritionistId: string): void {
  for (const key of cache.keys()) if (key.startsWith(`${nutritionistId}:`)) cache.delete(key);
}

export function getCalendarBusy(input: {
  nutritionistId: string; encryptedRefreshToken: string | null; from: Date; to: Date; excludeEventId?: string;
}): Promise<BusyInterval[]> {
  if (!input.encryptedRefreshToken) return Promise.resolve([]);
  const now = Date.now();
  for (const [key, value] of cache) if (value.expiresAt <= now) cache.delete(key);
  const from = new Date(Math.floor(input.from.getTime() / DAY) * DAY).toISOString();
  const to = new Date(Math.ceil(input.to.getTime() / DAY) * DAY).toISOString();
  const hash = createHash("sha256").update(input.encryptedRefreshToken).digest("hex");
  const key = `${input.nutritionistId}:${hash}:${from}:${to}:${input.excludeEventId ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit.value;
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  const value = createGoogleCalendarClient(input.encryptedRefreshToken).freeBusy(from, to, input.excludeEventId).catch((error: unknown) => {
    console.warn("[google-calendar] free/busy no disponible; usando agenda Granola", { status: error instanceof GoogleCalendarError ? error.status : "unavailable" });
    return [];
  });
  // También cachea fallos brevemente: un Google caído no recibe un request por clic.
  cache.set(key, { expiresAt: now + TTL, value });
  return value;
}
