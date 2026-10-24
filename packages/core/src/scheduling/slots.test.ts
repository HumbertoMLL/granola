import { describe, expect, it } from "vitest";
import {
  computeSlots,
  groupSlotsByDay,
  isSlotAvailable,
  windowsForDay,
  type AvailabilityOverride,
  type AvailabilityRule,
  type ComputeSlotsInput,
} from "./slots";

const MX = "America/Mexico_City";
const NY = "America/New_York";

// Lunes a viernes 9:00–13:00 hora CDMX.
const weekdays: AvailabilityRule[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startTime: "09:00",
  endTime: "13:00",
}));

const iso = (s: { startsAt: Date }) => s.startsAt.toISOString();

function base(over: Partial<ComputeSlotsInput> = {}): ComputeSlotsInput {
  return {
    rules: weekdays,
    overrides: [],
    busy: [],
    service: { durationMin: 60 },
    // Semana del lunes 9 mar 2026 (CDMX)
    from: new Date("2026-03-09T00:00:00Z"),
    to: new Date("2026-03-14T00:00:00Z"),
    timezone: MX,
    now: new Date("2026-03-01T00:00:00Z"),
    bufferMin: 0,
    minNoticeMin: 0,
    stepMin: 60,
    ...over,
  };
}

describe("computeSlots", () => {
  it("genera slots por regla semanal en UTC", () => {
    const slots = computeSlots(base({ to: new Date("2026-03-10T00:00:00Z") }));
    // Lunes 9: 9,10,11,12 CDMX = 15,16,17,18Z
    expect(slots.map(iso)).toEqual([
      "2026-03-09T15:00:00.000Z",
      "2026-03-09T16:00:00.000Z",
      "2026-03-09T17:00:00.000Z",
      "2026-03-09T18:00:00.000Z",
    ]);
    expect(slots[0]?.endsAt.toISOString()).toBe("2026-03-09T16:00:00.000Z");
  });

  it("no genera slots en días sin regla (fin de semana)", () => {
    const slots = computeSlots(
      base({ from: new Date("2026-03-14T00:00:00Z"), to: new Date("2026-03-16T00:00:00Z") }),
    );
    expect(slots).toEqual([]);
  });

  it("paso de 30 min con duración de 60", () => {
    const slots = computeSlots(base({ stepMin: 30, to: new Date("2026-03-10T00:00:00Z") }));
    expect(slots).toHaveLength(7); // 9:00, 9:30 … 12:00
    expect(iso(slots[1]!)).toBe("2026-03-09T15:30:00.000Z");
  });

  it("paso de 15 min", () => {
    const slots = computeSlots(base({ stepMin: 15, to: new Date("2026-03-10T00:00:00Z") }));
    expect(slots).toHaveLength(13);
  });

  it("la duración debe caber completa en la ventana", () => {
    const slots = computeSlots(
      base({ service: { durationMin: 90 }, stepMin: 60, to: new Date("2026-03-10T00:00:00Z") }),
    );
    // 9:00–10:30, 10:00–11:30, 11:00–12:30 (12:00–13:30 no cabe)
    expect(slots).toHaveLength(3);
  });

  it("excluye citas existentes (busy)", () => {
    const slots = computeSlots(
      base({
        to: new Date("2026-03-10T00:00:00Z"),
        busy: [{ startsAt: new Date("2026-03-09T16:00:00Z"), endsAt: new Date("2026-03-09T17:00:00Z") }],
      }),
    );
    expect(slots.map(iso)).toEqual([
      "2026-03-09T15:00:00.000Z",
      "2026-03-09T17:00:00.000Z",
      "2026-03-09T18:00:00.000Z",
    ]);
  });

  it("busy parcial bloquea cualquier slot que lo toque", () => {
    const slots = computeSlots(
      base({
        to: new Date("2026-03-10T00:00:00Z"),
        busy: [{ startsAt: new Date("2026-03-09T16:30:00Z"), endsAt: new Date("2026-03-09T16:45:00Z") }],
      }),
    );
    expect(slots.map(iso)).not.toContain("2026-03-09T16:00:00.000Z");
    expect(slots).toHaveLength(3);
  });

  it("aplica buffer entre citas", () => {
    const slots = computeSlots(
      base({
        stepMin: 30,
        bufferMin: 15,
        to: new Date("2026-03-10T00:00:00Z"),
        busy: [{ startsAt: new Date("2026-03-09T16:00:00Z"), endsAt: new Date("2026-03-09T17:00:00Z") }],
      }),
    );
    const list = slots.map(iso);
    // 9:30–10:30 termina a 10:30 y la cita empieza 10:00 → fuera. 9:00–10:00 termina justo
    // cuando empieza la cita: con buffer 15 también fuera.
    expect(list).not.toContain("2026-03-09T15:00:00.000Z");
    expect(list).not.toContain("2026-03-09T15:30:00.000Z");
    // 11:00 empieza justo al terminar la cita: con buffer fuera. 11:30 sí.
    expect(list).not.toContain("2026-03-09T17:00:00.000Z");
    expect(list).toContain("2026-03-09T17:30:00.000Z");
  });

  it("respeta aviso mínimo (minNoticeMin)", () => {
    const slots = computeSlots(
      base({
        now: new Date("2026-03-09T15:30:00Z"), // 9:30 CDMX
        minNoticeMin: 120,
        to: new Date("2026-03-10T00:00:00Z"),
      }),
    );
    // Earliest = 11:30 CDMX → solo 12:00
    expect(slots.map(iso)).toEqual(["2026-03-09T18:00:00.000Z"]);
  });

  it("recorta a [from, to]", () => {
    const slots = computeSlots(
      base({
        from: new Date("2026-03-09T16:30:00Z"),
        to: new Date("2026-03-09T18:30:00Z"),
      }),
    );
    // 11:00–12:00 (17Z) cabe; 12:00–13:00 (18Z–19Z) excede `to`.
    expect(slots.map(iso)).toEqual(["2026-03-09T17:00:00.000Z"]);
  });

  it("override bloquea día completo", () => {
    const overrides: AvailabilityOverride[] = [
      { date: "2026-03-09", startTime: null, endTime: null, isBlocked: true },
    ];
    const slots = computeSlots(base({ overrides, to: new Date("2026-03-11T00:00:00Z") }));
    expect(slots.every((s) => iso(s).startsWith("2026-03-10"))).toBe(true);
    expect(slots).toHaveLength(4);
  });

  it("override bloquea una ventana parcial", () => {
    const overrides: AvailabilityOverride[] = [
      { date: "2026-03-09", startTime: "10:00", endTime: "12:00", isBlocked: true },
    ];
    const slots = computeSlots(base({ overrides, to: new Date("2026-03-10T00:00:00Z") }));
    expect(slots.map(iso)).toEqual(["2026-03-09T15:00:00.000Z", "2026-03-09T18:00:00.000Z"]);
  });

  it("override agrega ventana extra (incluso en día sin regla)", () => {
    const overrides: AvailabilityOverride[] = [
      { date: "2026-03-14", startTime: "10:00", endTime: "12:00", isBlocked: false }, // sábado
    ];
    const slots = computeSlots(
      base({
        overrides,
        from: new Date("2026-03-14T00:00:00Z"),
        to: new Date("2026-03-15T06:00:00Z"),
      }),
    );
    expect(slots.map(iso)).toEqual(["2026-03-14T16:00:00.000Z", "2026-03-14T17:00:00.000Z"]);
  });

  it("ventanas solapadas de reglas se fusionan sin duplicar slots", () => {
    const rules: AvailabilityRule[] = [
      { weekday: 1, startTime: "09:00", endTime: "11:00" },
      { weekday: 1, startTime: "10:00", endTime: "13:00" },
    ];
    const slots = computeSlots(base({ rules, to: new Date("2026-03-10T00:00:00Z") }));
    expect(slots).toHaveLength(4);
  });

  it("DST: la regla 09:00 en Nueva York cambia de offset tras el 8 de marzo", () => {
    const rules: AvailabilityRule[] = [
      { weekday: 5, startTime: "09:00", endTime: "10:00" }, // viernes
      { weekday: 1, startTime: "09:00", endTime: "10:00" }, // lunes
    ];
    const slots = computeSlots(
      base({
        rules,
        timezone: NY,
        from: new Date("2026-03-06T00:00:00Z"),
        to: new Date("2026-03-10T00:00:00Z"),
      }),
    );
    expect(slots.map(iso)).toEqual([
      "2026-03-06T14:00:00.000Z", // EST
      "2026-03-09T13:00:00.000Z", // EDT
    ]);
  });

  it("zona que cruza medianoche UTC no pierde slots en el borde del rango", () => {
    const rules: AvailabilityRule[] = [{ weekday: 2, startTime: "20:00", endTime: "22:00" }]; // martes
    const slots = computeSlots(
      base({
        rules,
        timezone: MX,
        // Martes 10 mar 20:00 CDMX = 11 mar 02:00Z
        from: new Date("2026-03-11T00:00:00Z"),
        to: new Date("2026-03-11T06:00:00Z"),
      }),
    );
    expect(slots.map(iso)).toEqual(["2026-03-11T02:00:00.000Z", "2026-03-11T03:00:00.000Z"]);
  });

  it("entradas inválidas devuelven []", () => {
    expect(computeSlots(base({ service: { durationMin: 0 } }))).toEqual([]);
    expect(computeSlots(base({ to: new Date("2026-03-01T00:00:00Z") }))).toEqual([]);
  });
});

describe("windowsForDay", () => {
  it("regla con fin antes del inicio se ignora", () => {
    expect(windowsForDay("2026-03-09", [{ weekday: 1, startTime: "13:00", endTime: "09:00" }], [])).toEqual([]);
  });
});

describe("groupSlotsByDay", () => {
  it("agrupa por día civil en la zona del paciente", () => {
    const slots = computeSlots(base({ to: new Date("2026-03-11T00:00:00Z") }));
    const grouped = groupSlotsByDay(slots, MX);
    expect(grouped.map((g) => g.date)).toEqual(["2026-03-09", "2026-03-10"]);
    expect(grouped[0]?.slots).toHaveLength(4);
  });

  it("en otra zona el mismo slot puede caer en otro día", () => {
    const slots = [
      { startsAt: new Date("2026-03-11T02:00:00Z"), endsAt: new Date("2026-03-11T03:00:00Z") },
    ];
    expect(groupSlotsByDay(slots, MX)[0]?.date).toBe("2026-03-10");
    expect(groupSlotsByDay(slots, "Europe/Madrid")[0]?.date).toBe("2026-03-11");
  });
});

describe("isSlotAvailable", () => {
  const common = {
    rules: weekdays,
    overrides: [],
    busy: [],
    service: { durationMin: 60 },
    timezone: MX,
    now: new Date("2026-03-01T00:00:00Z"),
    minNoticeMin: 0,
    stepMin: 30,
  };

  it("acepta un slot ofrecido", () => {
    expect(
      isSlotAvailable({
        ...common,
        slot: { startsAt: new Date("2026-03-09T15:30:00Z"), endsAt: new Date("2026-03-09T16:30:00Z") },
      }),
    ).toBe(true);
  });

  it("rechaza slot desalineado al paso", () => {
    expect(
      isSlotAvailable({
        ...common,
        slot: { startsAt: new Date("2026-03-09T15:10:00Z"), endsAt: new Date("2026-03-09T16:10:00Z") },
      }),
    ).toBe(false);
  });

  it("rechaza duración distinta a la del servicio", () => {
    expect(
      isSlotAvailable({
        ...common,
        slot: { startsAt: new Date("2026-03-09T15:00:00Z"), endsAt: new Date("2026-03-09T15:30:00Z") },
      }),
    ).toBe(false);
  });

  it("rechaza slot ocupado o con aviso insuficiente", () => {
    expect(
      isSlotAvailable({
        ...common,
        busy: [{ startsAt: new Date("2026-03-09T15:00:00Z"), endsAt: new Date("2026-03-09T16:00:00Z") }],
        slot: { startsAt: new Date("2026-03-09T15:00:00Z"), endsAt: new Date("2026-03-09T16:00:00Z") },
      }),
    ).toBe(false);
    expect(
      isSlotAvailable({
        ...common,
        now: new Date("2026-03-09T14:30:00Z"),
        minNoticeMin: 120,
        slot: { startsAt: new Date("2026-03-09T15:00:00Z"), endsAt: new Date("2026-03-09T16:00:00Z") },
      }),
    ).toBe(false);
  });

  it("rechaza fuera de horario", () => {
    expect(
      isSlotAvailable({
        ...common,
        slot: { startsAt: new Date("2026-03-09T20:00:00Z"), endsAt: new Date("2026-03-09T21:00:00Z") },
      }),
    ).toBe(false);
  });
});
