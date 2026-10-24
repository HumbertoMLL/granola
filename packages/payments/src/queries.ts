import {
  and,
  appointments,
  db,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  or,
  patients,
  payments,
  services,
  sql,
} from "@granola/db";

/**
 * Consultas para el panel /app/cobros. TODAS filtran por `nutritionistId`
 * (regla dura #1): el join con `appointments` es el que lleva el filtro.
 */

export type PaymentListItem = {
  id: string;
  createdAt: Date;
  paidAt: Date | null;
  expiresAt: Date | null;
  status: "pending" | "paid" | "failed" | "expired" | "refunded";
  method: "card" | "spei" | "oxxo" | "cash";
  provider: "stripe" | "mercadopago" | "cash";
  amountCents: number;
  currency: string;
  appointmentId: string;
  appointmentStartsAt: Date;
  patientName: string;
  serviceName: string;
};

/** Rango [start, end) en UTC de un mes "YYYY-MM". La zona del nutri se aplica en el caller si hace falta. */
export function monthRange(month: string, timezoneOffsetMinutes = 0): { start: Date; end: Date } {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) throw new Error(`Mes inválido: ${month} (esperado YYYY-MM)`);
  const year = Number(m[1]);
  const mon = Number(m[2]) - 1;
  const start = new Date(Date.UTC(year, mon, 1, 0, 0, 0) + timezoneOffsetMinutes * 60_000);
  const end = new Date(Date.UTC(year, mon + 1, 1, 0, 0, 0) + timezoneOffsetMinutes * 60_000);
  return { start, end };
}

export async function listPaymentsForMonth(
  nutritionistId: string,
  month: string,
  opts: { timezoneOffsetMinutes?: number } = {},
): Promise<PaymentListItem[]> {
  const { start, end } = monthRange(month, opts.timezoneOffsetMinutes ?? 0);
  const rows = await db
    .select({
      id: payments.id,
      createdAt: payments.createdAt,
      paidAt: payments.paidAt,
      expiresAt: payments.expiresAt,
      status: payments.status,
      method: payments.method,
      provider: payments.provider,
      amountCents: payments.amountCents,
      currency: payments.currency,
      appointmentId: payments.appointmentId,
      appointmentStartsAt: appointments.startsAt,
      patientName: patients.name,
      serviceName: services.name,
    })
    .from(payments)
    .innerJoin(appointments, eq(appointments.id, payments.appointmentId))
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(
      and(
        eq(appointments.nutritionistId, nutritionistId),
        gte(payments.createdAt, start),
        lt(payments.createdAt, end),
        // Pendientes sin providerRef = checkout que nunca llegó al proveedor; no se muestran.
        or(isNotNull(payments.providerRef), eq(payments.provider, "cash")),
      ),
    )
    .orderBy(desc(payments.createdAt));
  return rows;
}

export type MonthSummary = {
  /** Suma de `paid` del mes, en centavos. */
  paidCents: number;
  paidCount: number;
  /** SPEI/OXXO esperando acreditación. */
  pendingCount: number;
  pendingCents: number;
  cashCount: number;
};

export async function summarizeMonth(
  nutritionistId: string,
  month: string,
  opts: { timezoneOffsetMinutes?: number } = {},
): Promise<MonthSummary> {
  const { start, end } = monthRange(month, opts.timezoneOffsetMinutes ?? 0);
  const [row] = await db
    .select({
      paidCents: sql<number>`coalesce(sum(case when ${payments.status} = 'paid' then ${payments.amountCents} else 0 end), 0)::int`,
      paidCount: sql<number>`count(*) filter (where ${payments.status} = 'paid')::int`,
      pendingCount: sql<number>`count(*) filter (where ${payments.status} = 'pending' and ${payments.providerRef} is not null)::int`,
      pendingCents: sql<number>`coalesce(sum(case when ${payments.status} = 'pending' and ${payments.providerRef} is not null then ${payments.amountCents} else 0 end), 0)::int`,
      cashCount: sql<number>`count(*) filter (where ${payments.status} = 'paid' and ${payments.provider} = 'cash')::int`,
    })
    .from(payments)
    .innerJoin(appointments, eq(appointments.id, payments.appointmentId))
    .where(
      and(eq(appointments.nutritionistId, nutritionistId), gte(payments.createdAt, start), lt(payments.createdAt, end)),
    );
  return {
    paidCents: Number(row?.paidCents ?? 0),
    paidCount: Number(row?.paidCount ?? 0),
    pendingCount: Number(row?.pendingCount ?? 0),
    pendingCents: Number(row?.pendingCents ?? 0),
    cashCount: Number(row?.cashCount ?? 0),
  };
}

export type UnpaidVisitAppointment = {
  appointmentId: string;
  startsAt: Date;
  status: "pending_payment" | "confirmed" | "cancelled" | "no_show" | "completed";
  patientName: string;
  serviceName: string;
  priceCents: number;
  currency: string;
  paymentMode: "prepaid" | "at_visit" | "optional";
};

/**
 * Citas cobrables en consulta (`at_visit` u `optional`) sin ningún pago `paid`,
 * del mes indicado y no canceladas. Alimenta la acción "Marcar pagado en efectivo".
 */
export async function listUnpaidVisitAppointments(
  nutritionistId: string,
  month: string,
  opts: { timezoneOffsetMinutes?: number } = {},
): Promise<UnpaidVisitAppointment[]> {
  const { start, end } = monthRange(month, opts.timezoneOffsetMinutes ?? 0);
  const paidSub = db
    .select({ appointmentId: payments.appointmentId })
    .from(payments)
    .where(and(eq(payments.appointmentId, appointments.id), eq(payments.status, "paid")))
    .limit(1);

  return db
    .select({
      appointmentId: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      patientName: patients.name,
      serviceName: services.name,
      priceCents: services.priceCents,
      currency: services.currency,
      paymentMode: services.paymentMode,
    })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(
      and(
        eq(appointments.nutritionistId, nutritionistId),
        gte(appointments.startsAt, start),
        lt(appointments.startsAt, end),
        or(eq(services.paymentMode, "at_visit"), eq(services.paymentMode, "optional")),
        or(eq(appointments.status, "confirmed"), eq(appointments.status, "completed")),
        isNull(sql`(${paidSub})`),
      ),
    )
    .orderBy(desc(appointments.startsAt));
}
