import { describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatPrice,
  formatShortDate,
  formatTimezone,
  STATUS_BADGE_VARIANT,
} from "./format";

describe("Presentación de fechas, precios y estados", () => {
  it("humaniza el día sin cambiar la zona del paciente", () => {
    const now = new Date("2026-10-26T04:00:00Z");
    expect(
      formatShortDate(
        new Date("2026-10-26T05:00:00Z"),
        "America/Mexico_City",
        now,
      ),
    ).toBe("hoy");
    expect(
      formatShortDate(
        new Date("2026-10-26T15:00:00Z"),
        "America/Mexico_City",
        now,
      ),
    ).toBe("mañana");
    expect(formatCalendarDate("2026-10-27", now)).toBe("mar 27 oct");
  });

  it("muestra el año de datos anteriores y lo omite para el mismo año", () => {
    const now = new Date("2026-10-25T18:00:00Z");
    expect(
      formatShortDate(
        new Date("2024-06-10T18:00:00Z"),
        "America/Mexico_City",
        now,
      ),
    ).toBe("lun 10 jun 2024");
    expect(
      formatShortDate(
        new Date("2026-06-10T18:00:00Z"),
        "America/Mexico_City",
        now,
      ),
    ).toBe("mié 10 jun");
    expect(
      formatShortDate(
        new Date("2024-06-10T18:00:00Z"),
        "America/Mexico_City",
        now,
        { weekday: false, relative: false },
      ),
    ).toBe("10 jun 2024");
  });

  it("compara el año en la zona mostrada al cruzar año nuevo", () => {
    const now = new Date("2026-01-01T02:00:00Z");
    const date = new Date("2025-06-10T18:00:00Z");
    expect(formatShortDate(date, "America/Mexico_City", now)).toBe(
      "mar 10 jun",
    );
    expect(formatShortDate(date, "UTC", now)).toBe("mar 10 jun 2025");
  });

  it("muestra nombres de ciudad y conserva los centavos cuando existen", () => {
    expect(formatTimezone("America/Mexico_City")).toBe("Ciudad de México");
    expect(formatTimezone("America/Cancun")).toBe("Cancún");
    expect(formatTimezone("Pacific/Auckland")).toBe("Auckland");
    expect(formatPrice(80000)).toBe("$800");
    expect(formatPrice(80050)).toBe("$800.50");
  });

  it("usa la misma semántica de estado en panel y páginas públicas", () => {
    expect(STATUS_BADGE_VARIANT).toEqual({
      pending_payment: "pending",
      confirmed: "confirmed",
      cancelled: "cancelled",
      no_show: "done",
      completed: "done",
    });
  });
});
