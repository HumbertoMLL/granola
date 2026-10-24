"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  appUrl,
  createConnectAccount,
  createDashboardLink,
  createOnboardingLink,
  getAccountStatus,
  markCashPaid,
  PaymentsError,
  PaymentsNotConfiguredError,
} from "@granola/payments";

import { requireNutritionist } from "@/lib/session";

export type ActionState = { error?: string; ok?: boolean };

function describeError(err: unknown): string {
  if (err instanceof PaymentsNotConfiguredError) return err.message;
  if (err instanceof PaymentsError) return err.message;
  console.error("[cobros/actions]", err);
  return "Algo salió mal. Intenta de nuevo.";
}

/**
 * "Conectar Stripe" / "Completar verificación": crea la cuenta Express si no
 * existe, genera el link de onboarding y redirige. Todo con el nutri de la sesión.
 */
export async function connectStripeAction(): Promise<ActionState> {
  const { user, nutritionist } = await requireNutritionist();
  const base = appUrl();

  let url: string;
  try {
    const accountId = await createConnectAccount(nutritionist.id, user.email);
    url = await createOnboardingLink(
      accountId,
      `${base}/api/connect/stripe/return`,
      `${base}/api/connect/stripe/refresh`,
    );
  } catch (err) {
    return { error: describeError(err) };
  }
  redirect(url);
}

/** Abre el dashboard Express del nutri (ver depósitos, cambiar cuenta bancaria). */
export async function openStripeDashboardAction(): Promise<ActionState> {
  const { nutritionist } = await requireNutritionist();
  if (!nutritionist.stripeAccountId) return { error: "Primero conecta Stripe." };

  let url: string;
  try {
    url = await createDashboardLink(nutritionist.stripeAccountId);
  } catch (err) {
    return { error: describeError(err) };
  }
  redirect(url);
}

/**
 * "Actualizar estado": única vía (además del webhook `account.updated`) por la
 * que el panel consulta a Stripe. `getAccountStatus` persiste los flags en
 * `nutritionists`; el render de /app/cobros solo lee de DB.
 */
export async function refreshStripeStatusAction(): Promise<ActionState> {
  const { nutritionist } = await requireNutritionist();
  if (!nutritionist.stripeAccountId) return { error: "Primero conecta Stripe." };
  try {
    await getAccountStatus(nutritionist.stripeAccountId);
  } catch (err) {
    return { error: describeError(err) };
  }
  revalidatePath("/app/cobros");
  return { ok: true };
}

const markCashPaidSchema = z.object({
  appointmentId: z.uuid(),
  /** Centavos; opcional (usa el precio del servicio). */
  amountCents: z.coerce.number().int().min(0).optional(),
});

/** "Marcar pagado en efectivo" para citas `at_visit` / `optional`. */
export async function markCashPaidAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { nutritionist } = await requireNutritionist();

  const raw = {
    appointmentId: formData.get("appointmentId"),
    amountCents: formData.get("amountCents") || undefined,
  };
  const parsed = markCashPaidSchema.safeParse(raw);
  if (!parsed.success) return { error: "Datos inválidos." };

  try {
    await markCashPaid({
      nutritionistId: nutritionist.id,
      appointmentId: parsed.data.appointmentId,
      amountCents: parsed.data.amountCents,
    });
  } catch (err) {
    return { error: describeError(err) };
  }

  revalidatePath("/app/cobros");
  revalidatePath("/app");
  return { ok: true };
}
