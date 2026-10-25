import {
  addDaysYmd,
  parseYmd,
  ymdInTz,
  zonedTimeToUtc,
} from "@granola/core/scheduling";

export function dashboardPeriods(now: Date, timezone: string) {
  const today = ymdInTz(now, timezone);
  const month = today.slice(0, 7);
  const { year, month: number } = parseYmd(today);
  const nextMonth = `${number === 12 ? year + 1 : year}-${String(number === 12 ? 1 : number + 1).padStart(2, "0")}-01`;
  return {
    today: zonedTimeToUtc(today, 0, timezone),
    tomorrow: zonedTimeToUtc(addDaysYmd(today, 1), 0, timezone),
    weekEnd: zonedTimeToUtc(addDaysYmd(today, 8), 0, timezone),
    monthStart: zonedTimeToUtc(`${month}-01`, 0, timezone),
    monthEnd: zonedTimeToUtc(nextMonth, 0, timezone),
  };
}

export type PaidAmount = {
  method: "card" | "spei" | "oxxo" | "cash";
  currency: string;
  amountCents: number;
};

/** No sumar monedas distintas ni convertir centavos a flotantes. */
export function aggregateIncome(rows: PaidAmount[]) {
  const currencies = new Map<
    string,
    {
      currency: string;
      totalCents: number;
      methods: Record<PaidAmount["method"], number>;
    }
  >();
  for (const row of rows) {
    const summary = currencies.get(row.currency) ?? {
      currency: row.currency,
      totalCents: 0,
      methods: { card: 0, spei: 0, oxxo: 0, cash: 0 },
    };
    summary.totalCents += row.amountCents;
    summary.methods[row.method] += row.amountCents;
    currencies.set(row.currency, summary);
  }
  return [...currencies.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
}

export function noShowRate(completed: number, noShows: number) {
  const total = completed + noShows;
  return {
    total,
    noShows,
    percent: total === 0 ? null : (noShows / total) * 100,
  };
}

export function groupAppointments<T extends { startsAt: Date }>(
  rows: T[],
  timezone: string,
) {
  const groups = new Map<string, T[]>();
  for (const row of [...rows].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  )) {
    const day = ymdInTz(row.startsAt, timezone);
    const group = groups.get(day) ?? [];
    group.push(row);
    groups.set(day, group);
  }
  return [...groups].map(([date, appointments]) => ({ date, appointments }));
}

export function formatDashboardMoney(cents: number, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
