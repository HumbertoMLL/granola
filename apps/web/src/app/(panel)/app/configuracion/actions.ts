"use server";

import { headers } from "next/headers";
import { saveProfileIdentity } from "@/components/configuracion/save-profile";
import { revalidatePath, updateTag } from "next/cache";
import { accountSchema, notificationSchema } from "@/components/configuracion/schemas";
import { auth } from "@/lib/auth";
import { and, appointments, db, eq, nutritionists, patients, services, sql, users } from "@/lib/db";
import { requireNutritionist } from "@/lib/session";
import { cacheTagFor } from "@/lib/public-profile";
import { accountDeletionScope, buildAccountExport } from "./data";

export async function saveAccount(input: unknown) {
  const { user, nutritionist } = await requireNutritionist();
  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const result = await saveProfileIdentity(nutritionist, { displayName: parsed.data.name, slug: nutritionist.slug });
  if (!result.ok) return result;
  await db.update(users).set({ name: parsed.data.name, updatedAt: new Date() }).where(eq(users.id, user.id));
  updateTag(cacheTagFor(nutritionist.slug));
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function saveNotifications(input: unknown) {
  const { nutritionist } = await requireNutritionist();
  const parsed = notificationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Preferencia inválida" };
  // No hay columna dedicada. JSONB merge conserva las opciones visuales del tema.
  await db.update(nutritionists).set({
    theme: sql`${nutritionists.theme} || ${JSON.stringify(parsed.data)}::jsonb`, updatedAt: new Date(),
  }).where(eq(nutritionists.id, nutritionist.id));
  revalidatePath("/app/configuracion");
  return { ok: true };
}

export async function exportAccount() {
  const { user, nutritionist } = await requireNutritionist();
  const [ownedServices, ownedPatients, ownedAppointments] = await Promise.all([
    db.select().from(services).where(eq(services.nutritionistId, nutritionist.id)),
    db.select().from(patients).where(eq(patients.nutritionistId, nutritionist.id)),
    db.select().from(appointments).where(eq(appointments.nutritionistId, nutritionist.id)),
  ]);
  return JSON.stringify(buildAccountExport({ nutritionist, email: user.email, services: ownedServices, patients: ownedPatients, appointments: ownedAppointments }, new Date()), null, 2);
}

export async function deleteAccount(input: unknown) {
  const { user, nutritionist } = await requireNutritionist();
  let scope;
  try { scope = accountDeletionScope(input, { nutritionistId: nutritionist.id, userId: user.id }); }
  catch { return { ok: false, error: "Escribe ELIMINAR para confirmar" }; }
  // appointments tiene FK restrict hacia pacientes y servicios: se borra primero.
  // batch es una transacción en neon-http; users propaga CASCADE a todo el dominio y auth.
  await db.batch([
    db.delete(appointments).where(eq(appointments.nutritionistId, scope[0].nutritionistId)),
    db.delete(users).where(and(eq(users.id, scope[1].userId), eq(users.id, nutritionist.userId))),
  ]);
  updateTag(cacheTagFor(nutritionist.slug));
  await auth.api.signOut({ headers: await headers() });
  return { ok: true };
}
