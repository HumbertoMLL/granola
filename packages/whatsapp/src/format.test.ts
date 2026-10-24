import { describe, expect, it } from "vitest";
import { formatDateMx, formatDateTimeMx, formatMoneyMx, formatTimeMx } from "./format";

const TZ = "America/Mexico_City";
// 2026-10-29 16:00Z = 10:00 a.m. en CDMX (UTC-6, sin horario de verano desde 2022).
const d = new Date("2026-10-29T16:00:00.000Z");
const now = new Date("2026-10-24T12:00:00.000Z");

describe("format es-MX", () => {
  it("hora en 12h con a.m./p.m.", () => {
    expect(formatTimeMx(d, TZ)).toBe("10:00 a.m.");
    expect(formatTimeMx(new Date("2026-10-29T00:30:00.000Z"), TZ)).toBe("6:30 p.m.");
    expect(formatTimeMx(new Date("2026-10-29T06:00:00.000Z"), TZ)).toBe("12:00 a.m.");
    expect(formatTimeMx(new Date("2026-10-29T18:00:00.000Z"), TZ)).toBe("12:00 p.m.");
  });

  it("fecha larga sin año si es el año en curso", () => {
    expect(formatDateMx(d, TZ, now)).toBe("jueves 29 de octubre");
    expect(formatDateMx(new Date("2027-01-05T16:00:00.000Z"), TZ, now)).toBe("martes 5 de enero de 2027");
  });

  it("fecha + hora", () => {
    expect(formatDateTimeMx(d, TZ, now)).toBe("jueves 29 de octubre, 10:00 a.m.");
  });

  it("respeta la zona horaria", () => {
    // Misma hora UTC: en Tijuana (UTC-7) son las 9:00 a.m.
    expect(formatTimeMx(d, "America/Tijuana")).toBe("9:00 a.m.");
  });

  it("dinero", () => {
    expect(formatMoneyMx(65000)).toBe("$650.00 MXN");
    expect(formatMoneyMx(123456)).toBe("$1,234.56 MXN");
  });
});
