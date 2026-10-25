import "server-only";

import { ymdInTz } from "@granola/core/scheduling";

import {
  and,
  appointments,
  availabilityOverrides,
  availabilityRules,
  count,
  db,
  eq,
  gte,
  inArray,
  isNotNull,
  lt,
  patients,
  payments,
  services,
} from "@/lib/db";
import {
  aggregateIncome,
  dashboardPeriods,
  noShowRate,
} from "@/components/dashboard/aggregation";

export async function listDashboardAppointments(
  nutritionistId: string,
  now: Date,
  timezone: string,
  period: "today" | "week",
) {
  const bounds = dashboardPeriods(now, timezone);
  return db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      patientName: patients.name,
      serviceName: services.name,
    })
    .from(appointments)
    .innerJoin(
      patients,
      and(
        eq(patients.id, appointments.patientId),
        eq(patients.nutritionistId, nutritionistId),
      ),
    )
    .innerJoin(
      services,
      and(
        eq(services.id, appointments.serviceId),
        eq(services.nutritionistId, nutritionistId),
      ),
    )
    .where(
      and(
        eq(appointments.nutritionistId, nutritionistId),
        gte(
          appointments.startsAt,
          period === "today" ? bounds.today : bounds.tomorrow,
        ),
        lt(
          appointments.startsAt,
          period === "today" ? bounds.tomorrow : bounds.weekEnd,
        ),
        period === "week"
          ? inArray(appointments.status, ["confirmed", "pending_payment"])
          : undefined,
      ),
    )
    .orderBy(appointments.startsAt);
}

export async function getDashboardIncome(
  nutritionistId: string,
  now: Date,
  timezone: string,
) {
  const { monthStart, monthEnd } = dashboardPeriods(now, timezone);
  const rows = await db
    .select({
      method: payments.method,
      currency: payments.currency,
      amountCents: payments.amountCents,
    })
    .from(payments)
    .innerJoin(appointments, eq(appointments.id, payments.appointmentId))
    .where(
      and(
        eq(appointments.nutritionistId, nutritionistId),
        eq(payments.status, "paid"),
        gte(payments.paidAt, monthStart),
        lt(payments.paidAt, monthEnd),
      ),
    );
  return aggregateIncome(rows);
}

export async function getDashboardNewPatients(
  nutritionistId: string,
  now: Date,
  timezone: string,
) {
  const { monthStart, monthEnd } = dashboardPeriods(now, timezone);
  const [row] = await db
    .select({ total: count() })
    .from(patients)
    .where(
      and(
        eq(patients.nutritionistId, nutritionistId),
        gte(patients.createdAt, monthStart),
        lt(patients.createdAt, monthEnd),
      ),
    );
  return row?.total ?? 0;
}

/** Comparación del mes anterior en la misma zona, con las lecturas y tenant existentes. */
export async function getDashboardPreviousMonth(
  nutritionistId: string,
  now: Date,
  timezone: string,
) {
  const previous = new Date(
    dashboardPeriods(now, timezone).monthStart.getTime() - 1,
  );
  const [income, newPatients, noShows] = await Promise.all([
    getDashboardIncome(nutritionistId, previous, timezone),
    getDashboardNewPatients(nutritionistId, previous, timezone),
    getDashboardNoShows(nutritionistId, previous, timezone),
  ]);
  return { income, newPatients, noShows };
}

export async function getDashboardNoShows(
  nutritionistId: string,
  now: Date,
  timezone: string,
) {
  const { monthStart, monthEnd } = dashboardPeriods(now, timezone);
  const rows = await db
    .select({ status: appointments.status, total: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.nutritionistId, nutritionistId),
        gte(appointments.startsAt, monthStart),
        lt(appointments.startsAt, monthEnd),
        lt(appointments.endsAt, now),
        inArray(appointments.status, ["completed", "no_show"]),
      ),
    )
    .groupBy(appointments.status);
  return noShowRate(
    rows.find((r) => r.status === "completed")?.total ?? 0,
    rows.find((r) => r.status === "no_show")?.total ?? 0,
  );
}

export async function hasDashboardAvailability(
  nutritionistId: string,
  now: Date,
  timezone: string,
) {
  const date = ymdInTz(now, timezone);
  const [rules, overrides] = await Promise.all([
    db.query.availabilityRules.findFirst({
      columns: { id: true },
      where: eq(availabilityRules.nutritionistId, nutritionistId),
    }),
    db.query.availabilityOverrides.findFirst({
      columns: { id: true },
      where: and(
        eq(availabilityOverrides.nutritionistId, nutritionistId),
        eq(availabilityOverrides.isBlocked, false),
        gte(availabilityOverrides.date, date),
        isNotNull(availabilityOverrides.startTime),
        isNotNull(availabilityOverrides.endTime),
      ),
    }),
  ]);
  return Boolean(rules || overrides);
}
