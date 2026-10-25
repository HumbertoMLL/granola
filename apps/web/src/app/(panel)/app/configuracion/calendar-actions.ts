"use server";

import { revalidatePath } from "next/cache";
import { clearCalendarBusyCache } from "@granola/google-calendar";
import { accounts, and, db, eq, nutritionists } from "@/lib/db";
import { requireNutritionist } from "@/lib/session";

export async function disconnectGoogleCalendar(): Promise<void> {
  const { user, nutritionist } = await requireNutritionist();
  await db.update(nutritionists).set({ googleRefreshTokenEnc: null, updatedAt: new Date() })
    .where(and(eq(nutritionists.id, nutritionist.id), eq(nutritionists.userId, user.id)));
  // Conserva la identidad de login, elimina también las credenciales OAuth duplicadas.
  await db.update(accounts).set({ refreshToken: null, accessToken: null, updatedAt: new Date() })
    .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "google")));
  clearCalendarBusyCache(nutritionist.id);
  revalidatePath("/app/configuracion");
}
