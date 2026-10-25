import { beforeEach, describe, expect, it } from "vitest";

import { seedAppointment, seedNutritionist, seedPatient } from "@granola/db/testing";

import { db, eq, patients, payments } from "@/lib/db";

import {
  getDashboardIncome,
  getDashboardNewPatients,
  getDashboardNoShows,
  listDashboardAppointments,
} from "./dashboard";

const TZ = "America/Mexico_City"; // UTC-6 todo el año (México eliminó el horario de verano)

// "Ahora" fijo: martes 20 oct 2026, 12:00 en CDMX.
const NOW = new Date("2026-10-20T18:00:00Z");

type Seeded = Awaited<ReturnType<typeof seedNutritionist>>;

let paymentSeq = 0;

async function seedPayment(input: {
  appointmentId: string;
  amountCents: number;
  status: "pending" | "paid" | "failed" | "expired" | "refunded";
  paidAt: Date | null;
  method?: "card" | "spei" | "oxxo" | "cash";
}) {
  paymentSeq += 1;
  const method = input.method ?? "card";
  await db.insert(payments).values({
    appointmentId: input.appointmentId,
    provider: method === "cash" ? "cash" : "stripe",
    providerRef: method === "cash" ? null : `pi_test_dashboard_${paymentSeq}_${Date.now()}`,
    amountCents: input.amountCents,
    currency: "MXN",
    status: input.status,
    method,
    paidAt: input.paidAt,
  });
}

async function seedPatientCreatedAt(nutritionistId: string, createdAt: Date) {
  const patient = await seedPatient({ nutritionistId });
  await db.update(patients).set({ createdAt }).where(eq(patients.id, patient.id));
  return patient;
}

/** Datos de una nutrióloga en octubre: 1 cita hoy, 1 en la semana, pagos, no-show y paciente nuevo. */
async function seedMonth({ nutritionist }: Seeded, amounts: { paid: number; pending: number }) {
  const nid = nutritionist.id;
  const today = await seedAppointment({
    nutritionistId: nid,
    startsAt: new Date("2026-10-20T16:00:00Z"), // 10:00 local de hoy
    status: "confirmed",
  });
  const thisWeek = await seedAppointment({
    nutritionistId: nid,
    startsAt: new Date("2026-10-23T16:00:00Z"),
    status: "confirmed",
  });
  const completed = await seedAppointment({
    nutritionistId: nid,
    startsAt: new Date("2026-10-05T16:00:00Z"),
    status: "completed",
  });
  const noShow = await seedAppointment({
    nutritionistId: nid,
    startsAt: new Date("2026-10-06T16:00:00Z"),
    status: "no_show",
  });
  await seedPayment({
    appointmentId: completed.id,
    amountCents: amounts.paid,
    status: "paid",
    paidAt: new Date("2026-10-05T17:00:00Z"),
  });
  await seedPayment({
    appointmentId: today.id,
    amountCents: amounts.pending,
    status: "pending",
    paidAt: null,
  });
  await seedPatientCreatedAt(nid, new Date("2026-10-10T18:00:00Z"));
  return { today, thisWeek, completed, noShow };
}

describe("Cuando una nutrióloga abre su dashboard", () => {
  let a: Seeded;
  let b: Seeded;

  beforeEach(async () => {
    a = await seedNutritionist({ slug: "nutri-a", timezone: TZ });
    b = await seedNutritionist({ slug: "nutri-b", timezone: TZ });
  });

  describe("y otra nutrióloga también tiene citas y pagos", () => {
    let mineA: Awaited<ReturnType<typeof seedMonth>>;
    let mineB: Awaited<ReturnType<typeof seedMonth>>;

    beforeEach(async () => {
      mineA = await seedMonth(a, { paid: 50_000, pending: 10_000 });
      mineB = await seedMonth(b, { paid: 999_900, pending: 777_700 });
    });

    it("solo ve sus propias citas de hoy y de la semana", async () => {
      const today = await listDashboardAppointments(a.nutritionist.id, NOW, TZ, "today");
      const week = await listDashboardAppointments(a.nutritionist.id, NOW, TZ, "week");

      expect(today.map((r) => r.id)).toEqual([mineA.today.id]);
      expect(week.map((r) => r.id)).toEqual([mineA.thisWeek.id]);
      const seen = [...today, ...week].map((r) => r.id);
      expect(seen).not.toContain(mineB.today.id);
      expect(seen).not.toContain(mineB.thisWeek.id);
    });

    it("sus ingresos del mes no incluyen los pagos de la otra", async () => {
      const income = await getDashboardIncome(a.nutritionist.id, NOW, TZ);

      expect(income).toEqual([
        { currency: "MXN", totalCents: 50_000, methods: { card: 50_000, spei: 0, oxxo: 0, cash: 0 } },
      ]);
    });

    it("solo cuenta sus propios pacientes nuevos", async () => {
      // seedMonth crea 1 paciente explícito en octubre; las citas crean pacientes con createdAt = ahora real.
      await db
        .update(patients)
        .set({ createdAt: new Date("2026-09-15T18:00:00Z") })
        .where(eq(patients.nutritionistId, a.nutritionist.id));
      await seedPatientCreatedAt(a.nutritionist.id, new Date("2026-10-12T18:00:00Z"));

      expect(await getDashboardNewPatients(a.nutritionist.id, NOW, TZ)).toBe(1);
    });

    it("su tasa de no-show solo considera sus citas", async () => {
      expect(await getDashboardNoShows(a.nutritionist.id, NOW, TZ)).toEqual({
        total: 2,
        noShows: 1,
        percent: 50,
      });
    });
  });

  describe("y tiene pagos en distintos estados", () => {
    it("los ingresos del mes suman solo los pagos 'paid'", async () => {
      const nid = a.nutritionist.id;
      const appt = await seedAppointment({
        nutritionistId: nid,
        startsAt: new Date("2026-10-08T16:00:00Z"),
        status: "completed",
      });
      const paidAt = new Date("2026-10-08T17:00:00Z");
      await seedPayment({ appointmentId: appt.id, amountCents: 40_000, status: "paid", paidAt, method: "card" });
      await seedPayment({ appointmentId: appt.id, amountCents: 25_000, status: "paid", paidAt, method: "cash" });
      await seedPayment({ appointmentId: appt.id, amountCents: 11_100, status: "pending", paidAt: null });
      await seedPayment({ appointmentId: appt.id, amountCents: 22_200, status: "failed", paidAt: null });
      await seedPayment({ appointmentId: appt.id, amountCents: 33_300, status: "expired", paidAt: null });
      // Un reembolso conserva paid_at pero ya no es ingreso.
      await seedPayment({ appointmentId: appt.id, amountCents: 44_400, status: "refunded", paidAt });

      const income = await getDashboardIncome(nid, NOW, TZ);

      expect(income).toEqual([
        { currency: "MXN", totalCents: 65_000, methods: { card: 40_000, spei: 0, oxxo: 0, cash: 25_000 } },
      ]);
    });
  });

  describe("y hay movimientos el último día del mes a las 23:30 hora de CDMX", () => {
    // 31 oct 23:30 en CDMX = 1 nov 05:30 UTC: en UTC ya es noviembre, en local sigue siendo octubre.
    const lateOct31 = new Date("2026-11-01T05:30:00Z");
    const endsAt = new Date("2026-11-01T05:45:00Z");

    beforeEach(async () => {
      const appt = await seedAppointment({
        nutritionistId: a.nutritionist.id,
        startsAt: lateOct31,
        endsAt,
        status: "no_show",
      });
      await seedPayment({ appointmentId: appt.id, amountCents: 30_000, status: "paid", paidAt: lateOct31 });
      await db
        .update(patients)
        .set({ createdAt: lateOct31 })
        .where(eq(patients.nutritionistId, a.nutritionist.id));
    });

    it("cuentan en octubre si la nutri mira el 31 a las 23:55 local", async () => {
      const now = new Date("2026-11-01T05:55:00Z");

      expect(await getDashboardIncome(a.nutritionist.id, now, TZ)).toEqual([
        { currency: "MXN", totalCents: 30_000, methods: { card: 30_000, spei: 0, oxxo: 0, cash: 0 } },
      ]);
      expect(await getDashboardNewPatients(a.nutritionist.id, now, TZ)).toBe(1);
      expect(await getDashboardNoShows(a.nutritionist.id, now, TZ)).toEqual({
        total: 1,
        noShows: 1,
        percent: 100,
      });
    });

    it("no cuentan en noviembre aunque en UTC ya sea 1 de noviembre", async () => {
      const now = new Date("2026-11-15T18:00:00Z");

      expect(await getDashboardIncome(a.nutritionist.id, now, TZ)).toEqual([]);
      expect(await getDashboardNewPatients(a.nutritionist.id, now, TZ)).toBe(0);
      expect(await getDashboardNoShows(a.nutritionist.id, now, TZ)).toEqual({
        total: 0,
        noShows: 0,
        percent: null,
      });
    });
  });
});
