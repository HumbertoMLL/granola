import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { appointments, db, eq } from "@granola/db";
import { seedAppointment, seedNutritionist } from "@granola/db/testing";
import { GoogleCalendarClient } from "@granola/google-calendar";
import { computeAvailableSlots, loadSchedulingContext } from "@/lib/booking";
import { loadSchedulingContext as apiContext } from "../../../../packages/api/src/queries/public";

const from = new Date("2030-11-04T15:00:00Z");
const to = new Date("2030-11-04T21:00:00Z");
const googleBusy = { startsAt: new Date("2030-11-04T16:00:00Z"), endsAt: new Date("2030-11-04T17:00:00Z") };
let busy: MockInstance<GoogleCalendarClient["freeBusy"]>;
beforeEach(() => { busy = vi.spyOn(GoogleCalendarClient.prototype, "freeBusy").mockResolvedValue([googleBusy]); });

describe("Cuando se calculan horarios con un Calendar conectado", () => {
  it("resta busy de Google además de las citas Granola y usa el mismo helper en API v1", async () => {
    const { nutritionist } = await seedNutritionist({ googleRefreshTokenEnc: "encrypted-test-token" });
    const appt = await seedAppointment({ nutritionistId: nutritionist.id, startsAt: new Date("2030-11-04T18:00:00Z"), endsAt: new Date("2030-11-04T19:00:00Z"), status: "confirmed" });
    const slots = await computeAvailableSlots({ nutritionistId: nutritionist.id, timezone: nutritionist.timezone, settings: nutritionist, service: { durationMin: 30 }, from, to });
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.some((s) => s.startsAt < googleBusy.endsAt && s.endsAt > googleBusy.startsAt)).toBe(false);
    expect(slots.some((s) => s.startsAt < appt.endsAt && s.endsAt > appt.startsAt)).toBe(false);
    const api = await apiContext(nutritionist.id, from, to); expect(api.busy).toContainEqual(googleBusy);
    expect(busy).toHaveBeenCalledTimes(1);
  });
  it("al reagendar pasa el ID de Google de la cita propia y excluye su bloqueo local", async () => {
    const { nutritionist } = await seedNutritionist({ googleRefreshTokenEnc: "encrypted-test-token" });
    const appt = await seedAppointment({ nutritionistId: nutritionist.id, startsAt: from, endsAt: to });
    await db.update(appointments).set({ googleEventId: "own-event" }).where(eq(appointments.id, appt.id));
    const ctx = await loadSchedulingContext(nutritionist.id, from, to, appt.id);
    expect(ctx.busy).toEqual([googleBusy]); expect(busy).toHaveBeenCalledWith(expect.any(String), expect.any(String), "own-event");
  });
  it("ante Google caído usa solo las citas locales y loguea", async () => {
    const { nutritionist } = await seedNutritionist({ googleRefreshTokenEnc: "encrypted-test-token" });
    busy.mockRejectedValueOnce(new Error("Google unavailable"));
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await loadSchedulingContext(nutritionist.id, from, to)).busy).toEqual([]); expect(log).toHaveBeenCalled();
  });
  it("sin conexión no llama a Google", async () => {
    const { nutritionist } = await seedNutritionist();
    await loadSchedulingContext(nutritionist.id, from, to); expect(busy).not.toHaveBeenCalled();
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
