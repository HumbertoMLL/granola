import { describe, expect, it } from "vitest";
import {
  aggregateIncome,
  dashboardPeriods,
  formatDashboardMoney,
  groupAppointments,
  noShowRate,
} from "./aggregation";

describe("dashboardPeriods", () => {
  it("usa el mes y día locales aunque UTC ya esté en el mes siguiente", () => {
    const periods = dashboardPeriods(
      new Date("2026-11-01T03:00:00Z"),
      "America/Mexico_City",
    );
    expect(periods.today.toISOString()).toBe("2026-10-31T06:00:00.000Z");
    expect(periods.tomorrow.toISOString()).toBe("2026-11-01T06:00:00.000Z");
    expect(periods.monthStart.toISOString()).toBe("2026-10-01T06:00:00.000Z");
    expect(periods.monthEnd.toISOString()).toBe("2026-11-01T06:00:00.000Z");
    expect(periods.weekEnd.toISOString()).toBe("2026-11-08T06:00:00.000Z");
  });
  it("calcula cada frontera con su offset al cruzar horario de verano", () => {
    const periods = dashboardPeriods(
      new Date("2026-03-08T12:00:00Z"),
      "America/New_York",
    );
    expect(periods.today.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(periods.tomorrow.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(periods.monthStart.toISOString()).toBe("2026-03-01T05:00:00.000Z");
    expect(periods.monthEnd.toISOString()).toBe("2026-04-01T04:00:00.000Z");
  });
  it("cruza diciembre y contempla febrero bisiesto", () => {
    expect(
      dashboardPeriods(
        new Date("2026-12-20T12:00Z"),
        "UTC",
      ).monthEnd.toISOString(),
    ).toBe("2027-01-01T00:00:00.000Z");
    const leap = dashboardPeriods(new Date("2028-02-29T12:00Z"), "UTC");
    expect(leap.monthEnd.toISOString()).toBe("2028-03-01T00:00:00.000Z");
    expect(leap.tomorrow).toEqual(leap.monthEnd);
  });
});

describe("aggregateIncome", () => {
  it("suma centavos por método y mantiene monedas separadas", () => {
    expect(
      aggregateIncome([
        { method: "card", currency: "MXN", amountCents: 12345 },
        { method: "card", currency: "MXN", amountCents: 1 },
        { method: "spei", currency: "MXN", amountCents: 20000 },
        { method: "oxxo", currency: "MXN", amountCents: 30000 },
        { method: "cash", currency: "MXN", amountCents: 40000 },
        { method: "card", currency: "USD", amountCents: 500 },
      ]),
    ).toEqual([
      {
        currency: "MXN",
        totalCents: 102346,
        methods: { card: 12346, spei: 20000, oxxo: 30000, cash: 40000 },
      },
      {
        currency: "USD",
        totalCents: 500,
        methods: { card: 500, spei: 0, oxxo: 0, cash: 0 },
      },
    ]);
  });
  it("no inventa ingresos sin pagos", () =>
    expect(aggregateIncome([])).toEqual([]));
});

describe("noShowRate", () => {
  it("distingue falta de datos de una tasa de cero", () => {
    expect(noShowRate(0, 0)).toEqual({ total: 0, noShows: 0, percent: null });
    expect(noShowRate(4, 0).percent).toBe(0);
  });
  it("divide ausencias entre completadas y ausencias", () => {
    expect(noShowRate(3, 1)).toEqual({ total: 4, noShows: 1, percent: 25 });
    expect(noShowRate(0, 2).percent).toBe(100);
  });
});

describe("groupAppointments", () => {
  it("agrupa por día local y ordena sin modificar los datos recibidos", () => {
    const rows = [
      { id: "later", startsAt: new Date("2026-11-01T07:00Z") },
      { id: "utc-next-day", startsAt: new Date("2026-11-01T04:00Z") },
      { id: "first", startsAt: new Date("2026-10-31T08:00Z") },
    ];
    expect(groupAppointments(rows, "America/Mexico_City")).toEqual([
      { date: "2026-10-31", appointments: [rows[2], rows[1]] },
      { date: "2026-11-01", appointments: [rows[0]] },
    ]);
    expect(rows[0]?.id).toBe("later");
  });
  it("devuelve grupos vacíos cuando no hay citas", () =>
    expect(groupAppointments([], "UTC")).toEqual([]));
});

describe("formatDashboardMoney", () => {
  it("preserva los centavos y muestra cero como dinero", () => {
    expect(formatDashboardMoney(12345)).toBe("$123.45");
    expect(formatDashboardMoney(0)).toBe("$0");
  });
});
