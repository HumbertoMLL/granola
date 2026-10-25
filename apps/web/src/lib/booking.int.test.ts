import { describe, expect, it } from "vitest";
import {
  seedAppointment,
  seedNutritionist,
  seedService,
} from "@granola/db/testing";
import { computeAvailableSlots, getFirstAvailableSlot } from "./booking";

describe("Próximo horario público", () => {
  it("devuelve null sin perfil o sin servicios activos", async () => {
    expect(await getFirstAvailableSlot("no-existe")).toBeNull();
    await seedNutritionist({ slug: "sin-servicios" });
    expect(await getFirstAvailableSlot("sin-servicios")).toBeNull();
  });
  it("elige el primer slot real y se actualiza al ocuparse", async () => {
    const { nutritionist } = await seedNutritionist({ slug: "primero" });
    const service = await seedService({ nutritionistId: nutritionist.id });
    const slots = await computeAvailableSlots({
      nutritionistId: nutritionist.id,
      timezone: nutritionist.timezone,
      settings: nutritionist,
      service,
    });
    expect(slots.length).toBeGreaterThan(1);
    expect(await getFirstAvailableSlot("primero")).toEqual({
      startsAt: slots[0]!.startsAt.toISOString(),
      timezone: nutritionist.timezone,
    });
    await seedAppointment({
      nutritionistId: nutritionist.id,
      serviceId: service.id,
      startsAt: slots[0]!.startsAt,
      endsAt: slots[0]!.endsAt,
      status: "confirmed",
    });
    const next = await getFirstAvailableSlot("primero");
    expect(new Date(next!.startsAt).getTime()).toBeGreaterThan(
      slots[0]!.startsAt.getTime(),
    );
  });
});
