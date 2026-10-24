import { describe, expect, it } from "vitest";
import {
  addDaysYmd,
  formatDateInTz,
  formatTimeInTz,
  getTimeZoneOffsetMs,
  getZonedParts,
  isValidTimeZone,
  minutesToTime,
  parseTimeToMinutes,
  weekdayOfYmd,
  ymdInTz,
  zonedTimeToUtc,
} from "./tz";

const MX = "America/Mexico_City";
const NY = "America/New_York";

describe("zonedTimeToUtc", () => {
  it("convierte hora de CDMX (UTC-6, sin DST) a UTC", () => {
    const d = zonedTimeToUtc("2026-03-09", 9 * 60, MX);
    expect(d.toISOString()).toBe("2026-03-09T15:00:00.000Z");
  });

  it("respeta DST en Nueva York antes y después del cambio", () => {
    // 7 mar 2026: EST (UTC-5). 9 mar 2026: EDT (UTC-4).
    expect(zonedTimeToUtc("2026-03-07", 9 * 60, NY).toISOString()).toBe("2026-03-07T14:00:00.000Z");
    expect(zonedTimeToUtc("2026-03-09", 9 * 60, NY).toISOString()).toBe("2026-03-09T13:00:00.000Z");
  });

  it("hueco de DST: 02:30 del 8 mar 2026 en NY no existe → salta tras el cambio", () => {
    const d = zonedTimeToUtc("2026-03-08", 2 * 60 + 30, NY);
    // 02:30 EST no existe; el instante equivalente es 03:30 EDT = 07:30Z
    expect(d.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("hora repetida (fin de DST, 1 nov 2026 01:30 NY) elige la primera", () => {
    const d = zonedTimeToUtc("2026-11-01", 60 + 30, NY);
    // 01:30 EDT = 05:30Z (la primera ocurrencia)
    expect(d.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("cruza medianoche UTC (Buenos Aires UTC-3, 22:00 → 01:00Z del día siguiente)", () => {
    const d = zonedTimeToUtc("2026-05-10", 22 * 60, "America/Argentina/Buenos_Aires");
    expect(d.toISOString()).toBe("2026-05-11T01:00:00.000Z");
  });
});

describe("getZonedParts / ymdInTz / offset", () => {
  it("descompone un instante en la zona", () => {
    const p = getZonedParts(new Date("2026-03-09T15:30:00Z"), MX);
    expect(p).toEqual({ year: 2026, month: 3, day: 9, hour: 9, minute: 30, second: 0, weekday: 1 });
  });

  it("ymdInTz devuelve el día civil local aunque UTC ya sea otro día", () => {
    expect(ymdInTz(new Date("2026-03-10T03:00:00Z"), MX)).toBe("2026-03-09");
  });

  it("offset de CDMX es -6h todo el año", () => {
    expect(getTimeZoneOffsetMs(MX, new Date("2026-01-15T12:00:00Z"))).toBe(-6 * 3_600_000);
    expect(getTimeZoneOffsetMs(MX, new Date("2026-07-15T12:00:00Z"))).toBe(-6 * 3_600_000);
  });
});

describe("helpers de calendario", () => {
  it("parseTimeToMinutes acepta HH:MM y HH:MM:SS", () => {
    expect(parseTimeToMinutes("09:30")).toBe(570);
    expect(parseTimeToMinutes("09:30:00")).toBe(570);
    expect(() => parseTimeToMinutes("9h")).toThrow();
  });

  it("minutesToTime", () => {
    expect(minutesToTime(570)).toBe("09:30");
    expect(minutesToTime(0)).toBe("00:00");
  });

  it("addDaysYmd cruza meses y años", () => {
    expect(addDaysYmd("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysYmd("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysYmd("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("weekdayOfYmd: 2026-03-08 es domingo", () => {
    expect(weekdayOfYmd("2026-03-08")).toBe(0);
    expect(weekdayOfYmd("2026-03-09")).toBe(1);
  });

  it("isValidTimeZone", () => {
    expect(isValidTimeZone(MX)).toBe(true);
    expect(isValidTimeZone("Marte/Olympus")).toBe(false);
  });
});

describe("formato", () => {
  it("formatTimeInTz en 24h", () => {
    expect(formatTimeInTz(new Date("2026-03-09T15:05:00Z"), MX)).toBe("09:05");
  });

  it("formatDateInTz en español", () => {
    const s = formatDateInTz(new Date("2026-03-09T15:05:00Z"), MX);
    expect(s).toContain("lunes");
    expect(s).toContain("marzo");
    expect(s).toContain("2026");
  });
});
