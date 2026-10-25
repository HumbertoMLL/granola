"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";
import { db, eq, nutritionists, sql } from "@/lib/db";
import { requireNutritionist } from "@/lib/session";
import { cacheTagFor } from "@/lib/public-profile";
import { saveProfileIdentity } from "@/components/configuracion/save-profile";
import { createService, saveAvailabilityRules } from "../agenda/actions";
import { serviceSchema, ruleSchema } from "@/components/agenda/schemas";

async function advance(step: number) {
  const { nutritionist } = await requireNutritionist();
  await db.update(nutritionists).set({ onboardingStep: sql`greatest(${nutritionists.onboardingStep}, ${step})`, updatedAt: new Date() }).where(eq(nutritionists.id, nutritionist.id));
  updateTag(cacheTagFor(nutritionist.slug));
  revalidatePath("/app", "layout");
}

export async function saveOnboardingProfile(input: unknown) {
  const { nutritionist: n } = await requireNutritionist();
  const result = await saveProfileIdentity(n, input);
  if (!result.ok) return result;
  await advance(1);
  return { ok: true };
}

export async function saveOnboardingService(input: unknown) {
  const { nutritionist } = await requireNutritionist();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  if (nutritionist.onboardingStep !== 1) return { ok: false, error: "Este paso ya se guardó. Actualiza la página." };
  const result = await createService(parsed.data);
  if (!result.ok) return result;
  await advance(2);
  return { ok: true };
}

export async function saveOnboardingAvailability(input: unknown) {
  const parsed = z.array(ruleSchema).max(42).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const result = await saveAvailabilityRules(parsed.data);
  if (!result.ok) return result;
  await advance(3);
  return { ok: true };
}

/** Termina el wizard, incluido «lo hago después». No necesita datos del cliente. */
export async function finishOnboarding() {
  await advance(4);
  return { ok: true };
}
