import { afterEach, describe, expect, it, vi } from "vitest";
import { clearCalendarBusyCache, getCalendarBusy } from "./cache";
import { GoogleCalendarClient } from "./client";

const args = { nutritionistId: "nutri-cache-test", encryptedRefreshToken: "encrypted", from: new Date("2026-11-04T10:30:00Z"), to: new Date("2026-11-05T10:30:00Z") };
afterEach(() => { clearCalendarBusyCache(args.nutritionistId); vi.restoreAllMocks(); vi.useRealTimers(); });
describe("Caché free/busy descartable por instancia", () => {
  it("deduplica clics concurrentes y renueva a los 60 segundos", async () => {
    vi.useFakeTimers();
    const api = vi.spyOn(GoogleCalendarClient.prototype, "freeBusy").mockResolvedValue([]);
    await Promise.all([getCalendarBusy(args), getCalendarBusy({ ...args, from: new Date(args.from.getTime() + 1000) })]);
    expect(api).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60_001); await getCalendarBusy(args); expect(api).toHaveBeenCalledTimes(2);
  });
  it("invalida ante cambios y no mezcla tokens/rangos/tenants", async () => {
    const api = vi.spyOn(GoogleCalendarClient.prototype, "freeBusy").mockResolvedValue([]);
    await getCalendarBusy(args); await getCalendarBusy({ ...args, encryptedRefreshToken: "other" });
    await getCalendarBusy({ ...args, nutritionistId: "other-nutri" });
    clearCalendarBusyCache(args.nutritionistId); await getCalendarBusy(args);
    expect(api).toHaveBeenCalledTimes(4); clearCalendarBusyCache("other-nutri");
  });
  it("sin token salta; ante error devuelve vacío y loguea sin el error privado", async () => {
    const api = vi.spyOn(GoogleCalendarClient.prototype, "freeBusy").mockRejectedValue(new Error("secret-sensitive-response"));
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await getCalendarBusy({ ...args, encryptedRefreshToken: null })).toEqual([]); expect(api).not.toHaveBeenCalled();
    expect(await getCalendarBusy(args)).toEqual([]); await getCalendarBusy(args);
    expect(api).toHaveBeenCalledTimes(1); expect(JSON.stringify(log.mock.calls)).not.toContain("secret-sensitive-response");
  });
});
