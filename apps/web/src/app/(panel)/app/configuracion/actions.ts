"use server";

import { revalidatePath } from "next/cache";

import { saveProfileIdentity } from "@/components/configuracion/save-profile";
import { accountSchema, notificationsSchema } from "@/components/configuracion/schemas";
import { getClientIp } from "@/lib/booking";
import { auditLog, db, eq, nutritionists } from "@/lib/db";
import { requireNutritionist } from "@/lib/session";

import { collectAccountExport } from "./export";

export async function saveAccount(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { nutritionist } = await requireNutritionist();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  // Nombre público y users.name en un solo db.batch; el slug no cambia aquí.
  const result = await saveProfileIdentity(
    nutritionist,
    { displayName: parsed.data.name, slug: nutritionist.slug },
    { syncUserName: true },
  );
  if (!result.ok) return result;
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function saveNotifications(input: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { nutritionist } = await requireNutritionist();
  const parsed = notificationsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Elige si quieres recibir avisos por WhatsApp" };
  await db.update(nutritionists)
    .set({ notifyNewBooking: parsed.data.notifyNewBooking, updatedAt: new Date() })
    .where(eq(nutritionists.id, nutritionist.id));
  revalidatePath("/app/configuracion");
  return { ok: true };
}

/**
 * Descarga de datos (LFPDPPP, derecho de acceso). Devuelve el JSON como texto y
 * deja constancia en audit_log (`account.export`) con IP y conteos.
 */
export async function exportAccount(): Promise<string> {
  const { user, nutritionist } = await requireNutritionist();
  const data = await collectAccountExport(nutritionist.id, user.email);
  await db.insert(auditLog).values({
    actorId: user.id,
    action: "account.export",
    entity: "nutritionist",
    entityId: nutritionist.id,
    ip: await getClientIp(),
    meta: {
      patients: data.patients.length,
      appointments: data.appointments.length,
      payments: data.payments.length,
    },
  });
  return JSON.stringify(data, null, 2);
}
