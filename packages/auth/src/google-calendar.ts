import { randomUUID } from "node:crypto";
import { symmetricDecrypt, type SecretConfig } from "better-auth/crypto";
import { db, eq, nutritionists, users } from "@granola/db";
import { clearCalendarBusyCache } from "@granola/google-calendar";
import { encryptRefreshToken } from "@granola/google-calendar/crypto";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

/** Hook posterior a la persistencia OAuth. Better Auth entrega sus tokens ya cifrados. */
export async function persistGoogleCalendarAccount(
  account: { providerId: string; userId: string; refreshToken?: string | null; scope?: string | null },
  secret: string | SecretConfig,
): Promise<void> {
  if (account.providerId !== "google" || !account.refreshToken) return;
  if (!process.env.GOOGLE_TOKEN_ENC_KEY) {
    console.warn("[google-calendar] falta GOOGLE_TOKEN_ENC_KEY; Calendar no se conecta");
    return;
  }
  const scopes = new Set(account.scope?.split(/[ ,]+/));
  if (!GOOGLE_CALENDAR_SCOPES.every((scope) => scopes.has(scope))) return;
  const token = await symmetricDecrypt({ key: secret, data: account.refreshToken });
  const encrypted = encryptRefreshToken(token);
  const user = await db.query.users.findFirst({ where: eq(users.id, account.userId), columns: { name: true, image: true } });
  if (!user) return;
  // En el primer login social aún no pasó por requireNutritionist().
  const [profile] = await db.insert(nutritionists).values({
    userId: account.userId,
    slug: `nutri-${randomUUID()}`,
    displayName: user.name,
    avatarUrl: user.image,
    googleRefreshTokenEnc: encrypted,
  }).onConflictDoUpdate({
    target: nutritionists.userId,
    set: { googleRefreshTokenEnc: encrypted, updatedAt: new Date() },
  }).returning({ id: nutritionists.id });
  if (profile) clearCalendarBusyCache(profile.id);
}
