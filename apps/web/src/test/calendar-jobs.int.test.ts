import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { appointments, db, eq } from "@granola/db";
import { seedAppointment, seedNutritionist, seedPatient } from "@granola/db/testing";
import { GoogleCalendarClient } from "@granola/google-calendar";
import { encryptRefreshToken } from "@granola/google-calendar/crypto";
import { onAppointmentConfirmed } from "../../../../packages/jobs/src/functions/appointment-confirmed";
import { onAppointmentCancelled } from "../../../../packages/jobs/src/functions/appointment-cancelled";
import { onAppointmentRescheduled } from "../../../../packages/jobs/src/functions/appointment-rescheduled";

// Únicamente se sustituye la orquestación externa de Inngest; los handlers, queries
// y persistencia son reales. No se ejecutan sleeps de horas en una prueba.
vi.mock("../../../../packages/jobs/src/client", () => ({ inngest: {
  createFunction: (_options: unknown, _trigger: unknown, handler: unknown) => ({ handler }),
} }));

type Data = { appointmentId: string; nutritionistId: string; by?: "patient"; previousStartsAt?: string };
type TestContext = { event: { data: Data }; step: {
  run: <T>(name: string, fn: () => T | Promise<T>) => Promise<T>;
  sendEvent: (name: string, data: unknown) => Promise<void>;
  sleep: (name: string, duration: string) => Promise<void>;
} };
type TestJob = { handler: (context: TestContext) => Promise<unknown> };
class StopAfterCalendar extends Error {}
const meet = "https://meet.google.com/abc-defg-hij";
let create: MockInstance<GoogleCalendarClient["createEvent"]>;
let move: MockInstance<GoogleCalendarClient["updateEvent"]>;
let remove: MockInstance<GoogleCalendarClient["deleteEvent"]>;
let steps: string[];

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("WA_ACCESS_TOKEN", ""); vi.stubEnv("WA_PHONE_NUMBER_ID", "");
  vi.stubEnv("GOOGLE_TOKEN_ENC_KEY", Buffer.alloc(32, 7).toString("base64"));
  create = vi.spyOn(GoogleCalendarClient.prototype, "createEvent").mockResolvedValue({ id: "google-event", meetUrl: meet });
  move = vi.spyOn(GoogleCalendarClient.prototype, "updateEvent").mockResolvedValue({ id: "google-event", meetUrl: meet });
  remove = vi.spyOn(GoogleCalendarClient.prototype, "deleteEvent").mockResolvedValue(undefined);
  steps = [];
});

async function fixture(connected = true) {
  const { nutritionist } = await seedNutritionist({ googleRefreshTokenEnc: connected ? encryptRefreshToken("refresh") : null });
  const patient = await seedPatient({ nutritionistId: nutritionist.id, phoneWa: null });
  const appointment = await seedAppointment({ nutritionistId: nutritionist.id, patientId: patient.id, status: "confirmed" });
  return { appointment, data: { appointmentId: appointment.id, nutritionistId: nutritionist.id } };
}

async function run(job: unknown, data: Data) {
  try {
    await (job as TestJob).handler({ event: { data }, step: {
      run: async <T>(name: string, fn: () => T | Promise<T>): Promise<T> => {
        steps.push(name);
        if (name === "plan") throw new StopAfterCalendar();
        return fn();
      },
      sendEvent: async (name) => { steps.push(name); },
      sleep: async (name) => { steps.push(name); },
    } });
  } catch (error) { if (!(error instanceof StopAfterCalendar)) throw error; }
}
async function row(id: string) { return db.query.appointments.findFirst({ where: eq(appointments.id, id) }); }

describe("Cuando Inngest recibe eventos de citas con Google Calendar", () => {
  it("confirmed crea el evento antes de las confirmaciones y persiste id + Meet; el replay no duplica", async () => {
    const { appointment, data } = await fixture();
    await run(onAppointmentConfirmed, data);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ appointmentId: appointment.id, modality: "online" }));
    expect(await row(appointment.id)).toMatchObject({ googleEventId: "google-event", meetUrl: meet });
    expect(steps.indexOf("calendar-confirmed")).toBeLessThan(steps.indexOf("recargar-confirmacion"));
    expect(steps.indexOf("recargar-confirmacion")).toBeLessThan(steps.indexOf("wa-cita-confirmada"));
    expect(steps.indexOf("calendar-confirmed")).toBeLessThan(steps.indexOf("email-nueva-cita-nutri"));
    await run(onAppointmentConfirmed, data); expect(create).toHaveBeenCalledTimes(1);
  });
  it("si Meet sigue pending, lo recupera en un paso durable sin duplicar el evento", async () => {
    const { appointment, data } = await fixture();
    create.mockResolvedValueOnce({ id: "google-event", meetUrl: null });
    await run(onAppointmentConfirmed, data);
    expect(create).toHaveBeenCalledTimes(1); expect(move).toHaveBeenCalledTimes(1);
    expect(steps).toContain("esperar-meet-1"); expect(steps).toContain("calendar-meet-1");
    expect((await row(appointment.id))?.meetUrl).toBe(meet);
    expect(steps.indexOf("calendar-meet-1")).toBeLessThan(steps.indexOf("recargar-confirmacion"));
    expect(steps.indexOf("recargar-confirmacion")).toBeLessThan(steps.indexOf("wa-cita-confirmada"));
  });
  it("limita a tres reintentos de Meet y continúa las confirmaciones si sigue pendiente", async () => {
    const { data } = await fixture();
    create.mockResolvedValue({ id: "google-event", meetUrl: null });
    move.mockResolvedValue({ id: "google-event", meetUrl: null });
    await run(onAppointmentConfirmed, data);
    expect(create).toHaveBeenCalledOnce();
    expect(move).toHaveBeenCalledTimes(3);
    expect(steps.filter((name) => name.startsWith("esperar-meet-"))).toHaveLength(3);
    expect(steps.indexOf("calendar-meet-3")).toBeLessThan(steps.indexOf("wa-cita-confirmada"));
    expect(steps).toContain("email-nueva-cita-nutri");
    expect(steps).toContain("plan");
  });
  it("cancelled borra el evento y limpia sus referencias", async () => {
    const { appointment, data } = await fixture();
    await db.update(appointments).set({ status: "cancelled", googleEventId: "google-event", meetUrl: meet }).where(eq(appointments.id, appointment.id));
    await run(onAppointmentCancelled, { ...data, by: "patient" });
    expect(remove).toHaveBeenCalledWith("google-event");
    expect(await row(appointment.id)).toMatchObject({ googleEventId: null, meetUrl: null });
    expect(steps).toEqual(["cargar-cita", "wa-cita-cancelada", "calendar-cancelled"]);
  });
  it("rescheduled mueve el evento y después rearma los recordatorios", async () => {
    const { appointment, data } = await fixture();
    await db.update(appointments).set({ googleEventId: "google-event", meetUrl: meet }).where(eq(appointments.id, appointment.id));
    await run(onAppointmentRescheduled, { ...data, previousStartsAt: new Date(appointment.startsAt.getTime() - 86_400_000).toISOString() });
    expect(move).toHaveBeenCalledWith("google-event", expect.objectContaining({ startsAt: appointment.startsAt.toISOString() }));
    expect(create).not.toHaveBeenCalled();
    expect(steps.indexOf("calendar-rescheduled")).toBeLessThan(steps.indexOf("rearmar-recordatorios"));
  });
  it("sin token salta Google para confirmación y cancelación", async () => {
    const { appointment, data } = await fixture(false);
    await run(onAppointmentConfirmed, data);
    await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, appointment.id));
    await run(onAppointmentCancelled, { ...data, by: "patient" });
    expect(create).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(move).not.toHaveBeenCalled();
  });
  it("un fallo de Google no corta el plan posterior a WhatsApp ni revela el error privado", async () => {
    const { data } = await fixture();
    create.mockRejectedValueOnce(new Error("private-provider-response"));
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    await run(onAppointmentConfirmed, data);
    expect(steps).toContain("wa-cita-confirmada"); expect(steps).toContain("plan");
    expect(create).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalled(); expect(JSON.stringify(log.mock.calls)).not.toContain("private-provider-response");
  });
  it("si cancelan mientras Google crea el evento, lo borra en vez de dejarlo huérfano", async () => {
    const { appointment, data } = await fixture();
    create.mockImplementationOnce(async () => {
      await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, appointment.id));
      return { id: "google-event", meetUrl: meet };
    });
    await run(onAppointmentConfirmed, data);
    expect(remove).toHaveBeenCalledWith("google-event");
    expect((await row(appointment.id))?.googleEventId).toBeNull();
    expect(steps).not.toContain("wa-cita-confirmada");
    expect(steps).not.toContain("email-nueva-cita-nutri");
  });
  it("si reagendan mientras Google crea el evento, reconcilia las fechas más recientes", async () => {
    const { appointment, data } = await fixture();
    const startsAt = new Date(appointment.startsAt.getTime() + 86_400_000);
    const endsAt = new Date(appointment.endsAt.getTime() + 86_400_000);
    create.mockImplementationOnce(async () => {
      await db.update(appointments).set({ startsAt, endsAt }).where(eq(appointments.id, appointment.id));
      return { id: "google-event", meetUrl: meet };
    });
    await run(onAppointmentConfirmed, data);
    expect(move).toHaveBeenCalledWith("google-event", expect.objectContaining({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }));
    expect((await row(appointment.id))?.googleEventId).toBe("google-event");
  });
  it("un evento con otro nutritionistId no puede usar las credenciales de la cita", async () => {
    const { data } = await fixture(); const { nutritionist } = await seedNutritionist();
    await run(onAppointmentConfirmed, { ...data, nutritionistId: nutritionist.id });
    expect(create).not.toHaveBeenCalled();
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
