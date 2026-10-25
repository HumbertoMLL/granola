import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeCancelToken, seedAppointment, seedNutritionist, seedService } from "@granola/db/testing";

import { appointments, db, eq } from "@/lib/db";
import { sendEvent } from "@/lib/inngest-client";

import { cancelByPatient, fetchRescheduleSlots, rescheduleByPatient } from "./actions";

vi.mock("@/lib/inngest-client", () => ({ sendEvent: vi.fn(async () => true) }));

async function load(id: string) {
  const [row] = await db.select().from(appointments).where(eq(appointments.id, id));
  return row!;
}

describe("Cuando la paciente usa el link de su cita (/cita/<token>)", () => {
  let nutritionistId: string;
  let serviceId: string;

  beforeEach(async () => {
    const { nutritionist } = await seedNutritionist({ slug: "karla-test" });
    nutritionistId = nutritionist.id;
    serviceId = (await seedService({ nutritionistId })).id;
  });

  describe("y cancela con un token válido", () => {
    it("la cita queda cancelada por la paciente y se emite appointment/cancelled", async () => {
      const token = fakeCancelToken();
      const appt = await seedAppointment({ nutritionistId, serviceId, cancelToken: token, status: "confirmed" });

      expect(await cancelByPatient(token)).toEqual({ ok: true });

      const row = await load(appt.id);
      expect(row).toMatchObject({ status: "cancelled", cancelReason: "Cancelada por el paciente" });
      expect(row.cancelledAt).toBeInstanceOf(Date);
      expect(sendEvent).toHaveBeenCalledWith({
        name: "appointment/cancelled",
        data: { appointmentId: appt.id, nutritionistId, by: "patient" },
      });
    });

    it("una cita ya cancelada no se vuelve a cancelar ni re-emite el evento", async () => {
      const token = fakeCancelToken();
      await seedAppointment({ nutritionistId, serviceId, cancelToken: token, status: "cancelled" });

      expect(await cancelByPatient(token)).toEqual({ ok: false, error: "Esta cita ya está cancelada" });
      expect(sendEvent).not.toHaveBeenCalled();
    });

    it("si faltan menos de 2 horas no la deja cancelar (debe escribirle a la nutri)", async () => {
      const token = fakeCancelToken();
      const appt = await seedAppointment({
        nutritionistId,
        serviceId,
        cancelToken: token,
        startsAt: new Date(Date.now() + 60 * 60_000),
      });

      const res = await cancelByPatient(token);

      expect(res).toMatchObject({ ok: false, error: expect.stringContaining("menos de 2 horas") });
      expect((await load(appt.id)).status).toBe("confirmed");
    });
  });

  describe("y el token no es válido", () => {
    it.each([
      ["inexistente", fakeCancelToken()],
      ["demasiado corto", "abc"],
      ["con basura", "x".repeat(200)],
    ])("token %s → 'Cita no encontrada' y no toca ninguna cita", async (_label, token) => {
      const real = await seedAppointment({ nutritionistId, serviceId, status: "confirmed" });

      expect(await cancelByPatient(token)).toEqual({ ok: false, error: "Cita no encontrada" });
      expect(await rescheduleByPatient(token, new Date(Date.now() + 5 * 86_400_000).toISOString())).toEqual({
        ok: false,
        error: "Cita no encontrada",
      });
      expect((await load(real.id)).status).toBe("confirmed");
      expect(sendEvent).not.toHaveBeenCalled();
    });
  });

  describe("y reagenda", () => {
    it("a un horario ocupado por otra cita: falla con 'se acaba de ocupar' y la cita no se mueve", async () => {
      const token = fakeCancelToken();
      const mine = await seedAppointment({ nutritionistId, serviceId, cancelToken: token });
      const slots = await fetchRescheduleSlots(token);
      if (!slots.ok) throw new Error(slots.error);
      const target = slots.slots.find((s) => s.startsAt !== mine.startsAt.toISOString())!;
      // Otra paciente toma ese horario antes.
      await seedAppointment({ nutritionistId, serviceId, startsAt: new Date(target.startsAt), status: "confirmed" });

      const res = await rescheduleByPatient(token, target.startsAt);

      expect(res).toEqual({ ok: false, error: "Ese horario se acaba de ocupar. Elige otro, por favor." });
      expect((await load(mine.id)).startsAt.toISOString()).toBe(mine.startsAt.toISOString());
      expect(sendEvent).not.toHaveBeenCalled();
    });

    it("a un horario libre: se mueve, se reinician recordatorios y se emite appointment/rescheduled", async () => {
      const token = fakeCancelToken();
      const mine = await seedAppointment({ nutritionistId, serviceId, cancelToken: token });
      await db.update(appointments).set({ reminder24hSentAt: new Date() }).where(eq(appointments.id, mine.id));
      const slots = await fetchRescheduleSlots(token);
      if (!slots.ok) throw new Error(slots.error);
      const target = slots.slots.find((s) => s.startsAt !== mine.startsAt.toISOString())!;

      expect(await rescheduleByPatient(token, target.startsAt)).toEqual({ ok: true });

      const row = await load(mine.id);
      expect(row.startsAt.toISOString()).toBe(target.startsAt);
      expect(row.endsAt.toISOString()).toBe(target.endsAt);
      expect(row.reminder24hSentAt).toBeNull();
      expect(sendEvent).toHaveBeenCalledWith({
        name: "appointment/rescheduled",
        data: { appointmentId: mine.id, nutritionistId, previousStartsAt: mine.startsAt.toISOString() },
      });
    });
  });
});
