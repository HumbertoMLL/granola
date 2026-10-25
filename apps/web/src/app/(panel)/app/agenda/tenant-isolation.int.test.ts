import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedAppointment, seedNutritionist, seedService } from "@granola/db/testing";

import { appointments, db, eq, services } from "@/lib/db";
import { sendEvent } from "@/lib/inngest-client";
import { requireNutritionist, type NutritionistSession } from "@/lib/session";

import {
  cancelAppointment,
  completeAppointment,
  confirmAppointmentManually,
  markNoShow,
  toggleServiceActive,
} from "./actions";

vi.mock("@/lib/inngest-client", () => ({ sendEvent: vi.fn(async () => true) }));
// La sesión (Better Auth + cookies) es frontera: decidimos quién está logueada.
vi.mock("@/lib/session", () => ({ requireNutritionist: vi.fn() }));

type Seeded = Awaited<ReturnType<typeof seedNutritionist>>;

function loginAs({ user, nutritionist }: Seeded) {
  const session: NutritionistSession = {
    user: { ...user, image: user.image ?? null },
    nutritionist,
  };
  vi.mocked(requireNutritionist).mockResolvedValue(session);
}

async function statusOf(id: string) {
  const [row] = await db
    .select({ status: appointments.status, cancelledAt: appointments.cancelledAt })
    .from(appointments)
    .where(eq(appointments.id, id));
  return row;
}

describe("Cuando una nutrióloga opera su agenda (aislamiento por tenant)", () => {
  let a: Seeded;
  let b: Seeded;

  beforeEach(async () => {
    a = await seedNutritionist({ slug: "nutri-a" });
    b = await seedNutritionist({ slug: "nutri-b" });
    loginAs(a);
  });

  describe("y la cita es de otra nutrióloga", () => {
    it("no puede cancelarla: responde 'Cita no encontrada' y la cita sigue intacta", async () => {
      const apptB = await seedAppointment({ nutritionistId: b.nutritionist.id, status: "confirmed" });

      const res = await cancelAppointment(apptB.id, "intento ajeno");

      expect(res).toEqual({ ok: false, error: "Cita no encontrada" });
      expect(await statusOf(apptB.id)).toEqual({ status: "confirmed", cancelledAt: null });
      expect(sendEvent).not.toHaveBeenCalled();
    });

    it("no puede completarla", async () => {
      const apptB = await seedAppointment({ nutritionistId: b.nutritionist.id, status: "confirmed" });

      expect(await completeAppointment(apptB.id)).toEqual({ ok: false, error: "Cita no encontrada" });
      expect((await statusOf(apptB.id))?.status).toBe("confirmed");
      expect(sendEvent).not.toHaveBeenCalled();
    });

    it("no puede marcarla como no-show ni confirmarla a mano", async () => {
      const past = await seedAppointment({
        nutritionistId: b.nutritionist.id,
        startsAt: new Date(Date.now() - 2 * 86_400_000),
        status: "confirmed",
      });
      const pending = await seedAppointment({ nutritionistId: b.nutritionist.id, status: "pending_payment" });

      expect(await markNoShow(past.id)).toEqual({ ok: false, error: "Cita no encontrada" });
      expect(await confirmAppointmentManually(pending.id)).toEqual({ ok: false, error: "Cita no encontrada" });
      expect((await statusOf(past.id))?.status).toBe("confirmed");
      expect((await statusOf(pending.id))?.status).toBe("pending_payment");
      expect(sendEvent).not.toHaveBeenCalled();
    });

    it("tampoco puede desactivar sus servicios", async () => {
      const svcB = await seedService({ nutritionistId: b.nutritionist.id });

      expect(await toggleServiceActive(svcB.id, false)).toEqual({ ok: false, error: "Servicio no encontrado" });
      const [row] = await db.select({ isActive: services.isActive }).from(services).where(eq(services.id, svcB.id));
      expect(row?.isActive).toBe(true);
    });
  });

  describe("y la cita es suya (control positivo)", () => {
    it("cancelarla funciona y se emite appointment/cancelled por la nutrióloga", async () => {
      const apptA = await seedAppointment({ nutritionistId: a.nutritionist.id, status: "confirmed" });

      expect(await cancelAppointment(apptA.id, "  Se enfermó  ")).toEqual({ ok: true });

      const [row] = await db.select().from(appointments).where(eq(appointments.id, apptA.id));
      expect(row).toMatchObject({ status: "cancelled", cancelReason: "Se enfermó" });
      expect(row!.cancelledAt).toBeInstanceOf(Date);
      expect(sendEvent).toHaveBeenCalledWith({
        name: "appointment/cancelled",
        data: { appointmentId: apptA.id, nutritionistId: a.nutritionist.id, by: "nutritionist" },
      });
    });

    it("completarla funciona y se emite appointment/completed", async () => {
      const apptA = await seedAppointment({ nutritionistId: a.nutritionist.id, status: "confirmed" });

      expect(await completeAppointment(apptA.id)).toEqual({ ok: true });

      expect((await statusOf(apptA.id))?.status).toBe("completed");
      expect(sendEvent).toHaveBeenCalledWith({
        name: "appointment/completed",
        data: { appointmentId: apptA.id, nutritionistId: a.nutritionist.id },
      });
    });
  });
});
