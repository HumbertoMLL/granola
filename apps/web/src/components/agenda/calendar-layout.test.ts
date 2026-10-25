import { describe, expect, it } from "vitest";
import { freeRangesForDay, minuteInZone } from "./calendar-layout";
import type { AgendaData } from "./agenda-tabs";

const data: AgendaData = {
  slug: "karla",
  timezone: "America/Mexico_City",
  nowIso: "2026-10-26T06:00:00Z",
  scheduling: { minNoticeMin: 0, bufferMin: 15, slotStepMin: 15 },
  services: [
    {
      id: "service",
      name: "Seguimiento",
      durationMin: 30,
      priceCents: 50000,
      currency: "MXN",
      description: null,
      location: null,
      modality: "online",
      isActive: true,
      paymentMode: "optional",
      sortOrder: 0,
    },
  ],
  rules: [{ id: "rule", weekday: 1, startTime: "09:00", endTime: "12:00" }],
  overrides: [],
  appointments: [
    {
      id: "a",
      startsAt: "2026-10-26T16:00:00Z",
      endsAt: "2026-10-26T17:00:00Z",
      patientName: "Ana",
      patientPhone: null,
      meetUrl: null,
      status: "confirmed",
      modality: "online",
      serviceName: "Seguimiento",
      durationMin: 60,
    },
  ],
};

describe("Huecos de la agenda", () => {
  it("convierte UTC a minutos civiles y respeta el buffer de la cita", () => {
    expect(minuteInZone("2026-10-26T16:00:00Z", data.timezone)).toBe(600);
    const ranges = freeRangesForDay(data, "2026-10-26", new Date(data.nowIso));
    expect(ranges).toEqual([
      { startMinute: 540, endMinute: 585 },
      { startMinute: 675, endMinute: 720 },
    ]);
  });
  it("no ofrece días completamente bloqueados ni horarios sin servicios", () => {
    expect(
      freeRangesForDay(
        {
          ...data,
          overrides: [
            {
              id: "block",
              date: "2026-10-26",
              isBlocked: true,
              startTime: null,
              endTime: null,
            },
          ],
        },
        "2026-10-26",
        new Date(data.nowIso),
      ),
    ).toEqual([]);
    expect(
      freeRangesForDay(
        { ...data, services: [] },
        "2026-10-26",
        new Date(data.nowIso),
      ),
    ).toEqual([]);
  });
  it("filtrar la vista no libera el tiempo de otras citas", () => {
    const ranges = freeRangesForDay(data, "2026-10-26", new Date(data.nowIso));
    expect(
      ranges.some((range) => range.startMinute < 660 && range.endMinute > 600),
    ).toBe(false);
  });
});
