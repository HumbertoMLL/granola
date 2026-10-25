import { beforeEach, describe, expect, it, vi } from "vitest";

import { seedAppointment, seedNutritionist, seedService } from "@granola/db/testing";

import { appointments, db, eq, patients, payments } from "@/lib/db";
import { sendEvent } from "@/lib/inngest-client";
import { expectRedirect, TEST_CLIENT_IP } from "@/test/next-mocks";

import { createBooking, fetchSlots } from "./actions";

// Frontera externa: Inngest. La action solo debe *pedir* el evento.
vi.mock("@/lib/inngest-client", () => ({ sendEvent: vi.fn(async () => true) }));

// Para simular la carrera "otra reserva ganó el hueco entre la revalidación y el INSERT"
// forzamos que la revalidación diga "libre"; el exclusion constraint real decide.
const race = vi.hoisted(() => ({ skipRevalidation: false }));
vi.mock("@/lib/booking", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/booking")>();
  return {
    ...real,
    checkSlotAvailable: async (input: Parameters<typeof real.checkSlotAvailable>[0]) =>
      race.skipRevalidation ? true : real.checkSlotAvailable(input),
  };
});

const SLOT_TAKEN = "Ese horario se acaba de ocupar. Elige otro, por favor.";

async function firstSlot(slug: string, serviceId: string): Promise<string> {
  const res = await fetchSlots({ slug, serviceId });
  if (!res.ok) throw new Error(`fetchSlots falló: ${res.error}`);
  const slot = res.slots[0];
  if (!slot) throw new Error("La nutri de prueba no tiene slots");
  return slot.startsAt;
}

function bookingInput(over: { slug: string; serviceId: string; startsAt: string; phone?: string }) {
  return {
    slug: over.slug,
    serviceId: over.serviceId,
    startsAt: over.startsAt,
    modality: "online" as const,
    name: "María Paciente",
    dialCode: "52",
    phone: over.phone ?? "55 1234 5678",
    email: "maria@paciente.test",
    consent: true as const,
    timezone: "America/Mexico_City",
    notes: "Primera vez",
  };
}

describe("Cuando una paciente agenda en la página pública", () => {
  beforeEach(() => {
    race.skipRevalidation = false;
  });

  describe("y el horario está libre", () => {
    it("la cita queda confirmada y se emite appointment/confirmed", async () => {
      const { nutritionist } = await seedNutritionist({ slug: "karla-test" });
      const service = await seedService({ nutritionistId: nutritionist.id, paymentMode: "optional" });
      const startsAt = await firstSlot("karla-test", service.id);

      const url = await expectRedirect(() =>
        createBooking(bookingInput({ slug: "karla-test", serviceId: service.id, startsAt })),
      );

      const [appt] = await db.select().from(appointments).where(eq(appointments.nutritionistId, nutritionist.id));
      expect(appt).toMatchObject({ status: "confirmed", serviceId: service.id, modality: "online", notes: "Primera vez" });
      expect(appt!.startsAt.toISOString()).toBe(startsAt);
      expect(appt!.endsAt.getTime() - appt!.startsAt.getTime()).toBe(30 * 60_000);
      expect(appt!.cancelToken.length).toBeGreaterThanOrEqual(16);
      expect(url).toBe(`/karla-test/agendar/listo?cita=${encodeURIComponent(appt!.cancelToken)}`);

      expect(sendEvent).toHaveBeenCalledTimes(1);
      expect(sendEvent).toHaveBeenCalledWith({
        name: "appointment/confirmed",
        data: { appointmentId: appt!.id, nutritionistId: nutritionist.id },
      });
    });

    it("la paciente se crea con consentimiento LFPDPPP (fecha + IP) y WhatsApp en E.164", async () => {
      const { nutritionist } = await seedNutritionist({ slug: "karla-test" });
      const service = await seedService({ nutritionistId: nutritionist.id });
      const startsAt = await firstSlot("karla-test", service.id);

      await expectRedirect(() => createBooking(bookingInput({ slug: "karla-test", serviceId: service.id, startsAt })));

      const rows = await db.select().from(patients).where(eq(patients.nutritionistId, nutritionist.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        name: "María Paciente",
        phoneWa: "+525512345678",
        email: "maria@paciente.test",
        consentIp: TEST_CLIENT_IP,
        source: "booking",
      });
      expect(rows[0]!.consentAt).toBeInstanceOf(Date);
    });

    it("si la paciente ya existía (mismo WhatsApp) se reutiliza en vez de duplicarla", async () => {
      const { nutritionist } = await seedNutritionist({ slug: "karla-test" });
      const service = await seedService({ nutritionistId: nutritionist.id });
      const res = await fetchSlots({ slug: "karla-test", serviceId: service.id });
      if (!res.ok) throw new Error(res.error);
      const [a, b] = res.slots;

      await expectRedirect(() =>
        createBooking(bookingInput({ slug: "karla-test", serviceId: service.id, startsAt: a!.startsAt })),
      );
      await expectRedirect(() =>
        createBooking(bookingInput({ slug: "karla-test", serviceId: service.id, startsAt: b!.startsAt, phone: "+52 1 55 1234 5678" })),
      );

      const rows = await db.select().from(patients).where(eq(patients.nutritionistId, nutritionist.id));
      expect(rows).toHaveLength(1);
      const appts = await db.select().from(appointments).where(eq(appointments.patientId, rows[0]!.id));
      expect(appts).toHaveLength(2);
    });
  });

  describe("y el horario ya está ocupado", () => {
    it("la revalidación en servidor lo rechaza con 'se acaba de ocupar' y no crea nada", async () => {
      const { nutritionist } = await seedNutritionist({ slug: "karla-test" });
      const service = await seedService({ nutritionistId: nutritionist.id });
      const startsAt = await firstSlot("karla-test", service.id);
      await seedAppointment({ nutritionistId: nutritionist.id, serviceId: service.id, startsAt: new Date(startsAt) });

      const res = await createBooking(bookingInput({ slug: "karla-test", serviceId: service.id, startsAt }));

      expect(res).toEqual({ ok: false, error: SLOT_TAKEN });
      const rows = await db.select().from(appointments).where(eq(appointments.nutritionistId, nutritionist.id));
      expect(rows).toHaveLength(1); // solo la que ya existía
      expect(sendEvent).not.toHaveBeenCalled();
    });

    it("si gana la carrera otra reserva, el exclusion constraint (23P01) lo frena con el mismo mensaje", async () => {
      const { nutritionist } = await seedNutritionist({ slug: "karla-test" });
      const service = await seedService({ nutritionistId: nutritionist.id });
      const startsAt = await firstSlot("karla-test", service.id);
      // Cita que se traslapa 15 min con el slot pedido.
      await seedAppointment({
        nutritionistId: nutritionist.id,
        serviceId: service.id,
        startsAt: new Date(new Date(startsAt).getTime() + 15 * 60_000),
        status: "pending_payment",
      });
      race.skipRevalidation = true;

      const res = await createBooking(bookingInput({ slug: "karla-test", serviceId: service.id, startsAt }));

      expect(res).toEqual({ ok: false, error: SLOT_TAKEN });
      const rows = await db.select().from(appointments).where(eq(appointments.nutritionistId, nutritionist.id));
      expect(rows).toHaveLength(1);
      expect(sendEvent).not.toHaveBeenCalled();
    });
  });

  describe("y el servicio es prepagado pero la nutri no ha conectado Stripe", () => {
    it("la cita se confirma igual, se le dice 'paga en consulta' y no queda ningún pago colgado", async () => {
      const { nutritionist } = await seedNutritionist({ slug: "karla-test", stripeAccountId: null });
      const service = await seedService({
        nutritionistId: nutritionist.id,
        name: "Primera consulta",
        durationMin: 60,
        priceCents: 80000,
        paymentMode: "prepaid",
      });
      const startsAt = await firstSlot("karla-test", service.id);

      const url = await expectRedirect(() =>
        createBooking({ ...bookingInput({ slug: "karla-test", serviceId: service.id, startsAt }), paymentMethod: "card" }),
      );

      const [appt] = await db.select().from(appointments).where(eq(appointments.nutritionistId, nutritionist.id));
      expect(appt!.status).toBe("confirmed");
      expect(url).toBe(`/karla-test/agendar/listo?cita=${encodeURIComponent(appt!.cancelToken)}&pago=consulta`);
      expect(await db.select().from(payments).where(eq(payments.appointmentId, appt!.id))).toHaveLength(0);
      expect(sendEvent).toHaveBeenCalledWith({
        name: "appointment/confirmed",
        data: { appointmentId: appt!.id, nutritionistId: nutritionist.id },
      });
    });
  });

  describe("y los datos no son válidos", () => {
    it("sin consentimiento no se crea paciente ni cita", async () => {
      const { nutritionist } = await seedNutritionist({ slug: "karla-test" });
      const service = await seedService({ nutritionistId: nutritionist.id });
      const startsAt = await firstSlot("karla-test", service.id);

      const res = await createBooking({
        ...bookingInput({ slug: "karla-test", serviceId: service.id, startsAt }),
        consent: false as unknown as true,
      });

      expect(res).toMatchObject({ ok: false, fieldErrors: { consent: expect.any(String) } });
      expect(await db.select().from(patients)).toHaveLength(0);
      expect(await db.select().from(appointments)).toHaveLength(0);
    });
  });
});
