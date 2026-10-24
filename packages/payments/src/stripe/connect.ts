import { db, eq, nutritionists, type StripeRequirements } from "@granola/db";

import { PaymentsError } from "../errors";
import { getStripe, type Stripe } from "./client";

/**
 * Stripe Connect **Express**: Stripe hospeda el onboarding (KYC, cuenta
 * bancaria) y el dashboard de pagos del nutri; Granola solo guarda el
 * `acct_…`. Si el nutri ya tiene cuenta, la devuelve sin crear otra.
 */
export async function createConnectAccount(nutritionistId: string, email: string): Promise<string> {
  const nutri = await db.query.nutritionists.findFirst({
    where: eq(nutritionists.id, nutritionistId),
    columns: { id: true, stripeAccountId: true, displayName: true },
  });
  if (!nutri) throw new PaymentsError("nutritionist_not_found", "Nutriólogo/a no encontrado");
  if (nutri.stripeAccountId) return nutri.stripeAccountId;

  const account = await getStripe().accounts.create({
    type: "express",
    country: "MX",
    email,
    default_currency: "mxn",
    business_type: "individual",
    business_profile: {
      name: nutri.displayName,
      // 8099 = Health Practitioners, Medical Services (MCC).
      mcc: "8099",
      product_description: "Consultas de nutrición",
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { nutritionistId },
  });

  await db
    .update(nutritionists)
    .set({ stripeAccountId: account.id, updatedAt: new Date() })
    .where(eq(nutritionists.id, nutritionistId));

  return account.id;
}

/** Link de onboarding (caduca en minutos). `refreshUrl` se visita si el link venció. */
export async function createOnboardingLink(
  accountId: string,
  returnUrl: string,
  refreshUrl: string,
): Promise<string> {
  const link = await getStripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    return_url: returnUrl,
    refresh_url: refreshUrl,
  });
  return link.url;
}

export type ConnectAccountStatus = {
  accountId: string;
  /** Puede recibir pagos (onboarding completo). */
  chargesEnabled: boolean;
  /** Stripe ya le deposita al banco. */
  payoutsEnabled: boolean;
  /** `details_submitted`: ya terminó el formulario aunque falte verificación. */
  detailsSubmitted: boolean;
  /** Campos que Stripe exige ahora mismo (p. ej. `individual.id_number`). */
  currentlyDue: string[];
  /** Campos pendientes con fecha futura. */
  eventuallyDue: string[];
  /** Campos vencidos: la cuenta puede estar restringida. */
  pastDue: string[];
  /** Motivo de deshabilitación, si lo hay (`requirements.past_due`, `rejected.fraud`…). */
  disabledReason: string | null;
};

export function accountToStatus(account: Stripe.Account): ConnectAccountStatus {
  const req = account.requirements;
  return {
    accountId: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    currentlyDue: req?.currently_due ?? [],
    eventuallyDue: req?.eventually_due ?? [],
    pastDue: req?.past_due ?? [],
    disabledReason: req?.disabled_reason ?? null,
  };
}

/** Columnas de `nutritionists` que reflejan el estado de Connect. Puro. */
export function accountStatusToColumns(
  status: ConnectAccountStatus,
  now: Date = new Date(),
): {
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeRequirements: StripeRequirements;
} {
  return {
    stripeChargesEnabled: status.chargesEnabled,
    stripePayoutsEnabled: status.payoutsEnabled,
    stripeRequirements: {
      currentlyDue: status.currentlyDue,
      eventuallyDue: status.eventuallyDue,
      pastDue: status.pastDue,
      disabledReason: status.disabledReason,
      detailsSubmitted: status.detailsSubmitted,
      syncedAt: now.toISOString(),
    },
  };
}

/** Inverso de `accountStatusToColumns`: lo que el panel lee de DB sin llamar a Stripe. */
export function accountStatusFromColumns(row: {
  stripeAccountId: string;
  stripeChargesEnabled: boolean;
  stripePayoutsEnabled: boolean;
  stripeRequirements: StripeRequirements | null;
}): ConnectAccountStatus & { syncedAt: string | null } {
  const req = row.stripeRequirements ?? {};
  return {
    accountId: row.stripeAccountId,
    chargesEnabled: row.stripeChargesEnabled,
    payoutsEnabled: row.stripePayoutsEnabled,
    detailsSubmitted: Boolean(req.detailsSubmitted),
    currentlyDue: req.currentlyDue ?? [],
    eventuallyDue: req.eventuallyDue ?? [],
    pastDue: req.pastDue ?? [],
    disabledReason: req.disabledReason ?? null,
    syncedAt: req.syncedAt ?? null,
  };
}

/**
 * Guarda los flags de Connect en el nutri dueño de `status.accountId`.
 * Devuelve su id, o null si la cuenta no es de ningún nutri conocido.
 */
export async function persistAccountStatus(status: ConnectAccountStatus): Promise<string | null> {
  const [row] = await db
    .update(nutritionists)
    .set({ ...accountStatusToColumns(status), updatedAt: new Date() })
    .where(eq(nutritionists.stripeAccountId, status.accountId))
    .returning({ id: nutritionists.id });
  return row?.id ?? null;
}

/**
 * Consulta el estado en vivo (`accounts.retrieve`) y lo persiste en
 * `nutritionists`. Solo para acciones explícitas ("Actualizar estado", regreso
 * del onboarding); el render del panel lee de DB.
 */
export async function getAccountStatus(accountId: string): Promise<ConnectAccountStatus> {
  const account = await getStripe().accounts.retrieve(accountId);
  const status = accountToStatus(account);
  await persistAccountStatus(status);
  return status;
}

/** Link al dashboard Express del nutri (ver pagos, cambiar cuenta bancaria). */
export async function createDashboardLink(accountId: string): Promise<string> {
  const link = await getStripe().accounts.createLoginLink(accountId);
  return link.url;
}
