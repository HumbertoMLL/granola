import { describe, expect, it } from "vitest";
import { formatCalendarDate, formatPrice, formatShortDate, formatTimezone, STATUS_BADGE_VARIANT } from "./format";

describe("Presentación de fechas, precios y estados", () => {
  it("humaniza el día sin cambiar la zona del paciente", () => {
    const now = new Date("2026-10-26T04:00:00Z");
    expect(formatShortDate(new Date("2026-10-26T05:00:00Z"), "America/Mexico_City", now)).toBe("hoy");
    expect(formatShortDate(new Date("2026-10-26T15:00:00Z"), "America/Mexico_City", now)).toBe("mañana");
    expect(formatCalendarDate("2026-10-27")).toBe("mar 27 oct");
  });

  it("muestra nombres de ciudad y conserva los centavos cuando existen", () => {
    expect(formatTimezone("America/Mexico_City")).toBe("Ciudad de México");
    expect(formatTimezone("America/Cancun")).toBe("Cancún");
    expect(formatTimezone("Pacific/Auckland")).toBe("Auckland");
    expect(formatPrice(80000)).toBe("$800");
    expect(formatPrice(80050)).toBe("$800.50");
  });

  it("usa la misma semántica de estado en panel y páginas públicas", () => {
    expect(STATUS_BADGE_VARIANT).toEqual({ pending_payment: "pending", confirmed: "confirmed", cancelled: "cancelled", no_show: "done", completed: "done" });
  });
});
