import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { and, db, eq, nutritionists, waMessages } from "@granola/db";
import { seedAppointment, seedNutritionist, seedPatient } from "@granola/db/testing";
import { sendEmail } from "@granola/email";
import { GoogleCalendarClient } from "@granola/google-calendar";
import { encryptRefreshToken } from "@granola/google-calendar/crypto";

// Inngest es la frontera externa: ejecutamos cada callback de step una sola vez,
// sin esperar horas ni contactar su servicio. Las queries y los WhatsApp dry-run usan DB real.
type Steps = {
  run: (id: string, action: () => unknown) => Promise<unknown>;
  sleep: (id: string, duration: string) => Promise<void>;
  sleepUntil: (id: string, at: string) => Promise<void>;
  sendEvent: (id: string, event: unknown) => Promise<void>;
};
type Handler = (input: {
  event: { id: string; data: { appointmentId: string; nutritionistId: string; isReschedule?: boolean; by?: "patient" | "nutritionist" | "system" } };
  step: Steps;
}) => Promise<unknown>;
const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, Handler>() }));
vi.mock("../../../../packages/jobs/src/client", () => ({
  inngest: { createFunction: (config: { id: string }, _trigger: unknown, handler: Handler) => {
    handlers.set(config.id, handler);
    return { id: config.id };
  } },
}));
vi.mock("@granola/email", async (importOriginal) => ({
  ...await importOriginal<typeof import("@granola/email")>(),
  sendEmail: vi.fn(async () => ({ id: "resend-mocked-id", dryRun: false })),
}));
import "../../../../packages/jobs/src/functions/appointment-confirmed";
import "../../../../packages/jobs/src/functions/appointment-cancelled";

function steps() {
  return {
    run: vi.fn(async (_id: string, action: () => unknown) => action()),
    sleep: vi.fn(async () => undefined),
    sleepUntil: vi.fn(async () => undefined),
    sendEvent: vi.fn(async () => undefined),
  };
}
function handler(id: string): Handler {
  const result = handlers.get(id);
  if (!result) throw new Error(`No se registró ${id}`);
  return result;
}
beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("WA_ACCESS_TOKEN", ""); vi.stubEnv("WA_PHONE_NUMBER_ID", "");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

async function fixture(email: string | null = "ana@example.test", status: "confirmed" | "cancelled" = "confirmed") {
  const { nutritionist, user } = await seedNutritionist({ displayName: "Karla", email: "karla@example.test", phoneWa: "+525511111111" });
  const patient = await seedPatient({ nutritionistId: nutritionist.id, name: "Ana López", email, phoneWa: "+525522222222" });
  // Pasada para omitir recordatorios; las esperas son frontera mockeada.
  const appointment = await seedAppointment({ nutritionistId: nutritionist.id, patientId: patient.id,
    startsAt: new Date("2026-01-01T16:00:00Z"), endsAt: new Date("2026-01-01T16:30:00Z"), status });
  return { nutritionist, user, patient, appointment, data: { appointmentId: appointment.id, nutritionistId: nutritionist.id } };
}

describe("Cuando se confirma una cita y Resend está mockeado", () => {
  it("envía dos correos con los asuntos esperados y mantiene ambos WhatsApp", async () => {
    const f = await fixture();
    const step = steps();
    await handler("appointment-confirmed")({ event: { id: "evt-confirmed", data: f.data }, step });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: f.patient.email, subject: "Tu cita está confirmada", idempotencyKey: "confirmed-evt-confirmed-patient" }));
    expect(sendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: f.user.email, subject: "Tienes una nueva cita en Granola", idempotencyKey: "confirmed-evt-confirmed-nutritionist" }));
    const ids = step.run.mock.calls.map(([id]) => id);
    expect(ids.indexOf("email-cita-confirmada-paciente")).toBeGreaterThan(ids.indexOf("wa-nueva-cita-nutri"));
    expect(ids.indexOf("recargar-confirmacion")).toBeGreaterThan(ids.indexOf("calendar-confirmed"));
    expect(ids.indexOf("wa-cita-confirmada")).toBeGreaterThan(ids.indexOf("recargar-confirmacion"));
    expect(ids).toContain("email-nueva-cita-nutri");
    const rows = await db.select().from(waMessages).where(eq(waMessages.nutritionistId, f.nutritionist.id));
    expect(rows).toHaveLength(2);
  });
  it.each([false, true])("incluye el Meet recién persistido en correo y WhatsApp (Meet pendiente: %s)", async (pendingMeet) => {
    const f = await fixture();
    const meetUrl = "https://meet.google.com/abc-defg-hij";
    vi.stubEnv("GOOGLE_TOKEN_ENC_KEY", Buffer.alloc(32, 7).toString("base64"));
    await db.update(nutritionists).set({ googleRefreshTokenEnc: encryptRefreshToken("refresh-test") })
      .where(eq(nutritionists.id, f.nutritionist.id));
    const create = vi.spyOn(GoogleCalendarClient.prototype, "createEvent")
      .mockResolvedValue({ id: "google-event", meetUrl: pendingMeet ? null : meetUrl });
    const update = vi.spyOn(GoogleCalendarClient.prototype, "updateEvent")
      .mockResolvedValue({ id: "google-event", meetUrl });
    const step = steps();
    await handler("appointment-confirmed")({ event: { id: "evt-meet", data: f.data }, step });
    expect(create).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledTimes(pendingMeet ? 1 : 0);
    expect(sendEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({ text: expect.stringContaining(meetUrl) }));
    const messages = await db.select().from(waMessages).where(and(
      eq(waMessages.nutritionistId, f.nutritionist.id), eq(waMessages.patientId, f.patient.id),
    ));
    expect(messages).toHaveLength(1);
    expect(JSON.stringify(messages[0]?.payload)).toContain(meetUrl);
    const ids = step.run.mock.calls.map(([id]) => id);
    expect(ids.indexOf("recargar-confirmacion")).toBeGreaterThan(ids.indexOf(pendingMeet ? "calendar-meet-1" : "calendar-confirmed"));
  });
  it("sin email del paciente envía solo a la nutrióloga", async () => {
    const f = await fixture(null);
    await handler("appointment-confirmed")({ event: { id: "evt-no-email", data: f.data }, step: steps() });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: f.user.email, subject: "Tienes una nueva cita en Granola" }));
  });
  it("al rearmar recordatorios por reagendado no repite los correos de confirmación", async () => {
    const f = await fixture();
    await handler("appointment-confirmed")({ event: { id: "evt-rescheduled", data: { ...f.data, isReschedule: true } }, step: steps() });
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("un evento con el tenant equivocado no envía correos ni WhatsApp", async () => {
    const f = await fixture();
    const other = await seedNutritionist();
    const result = await handler("appointment-confirmed")({ event: { id: "evt-foreign", data: { ...f.data, nutritionistId: other.nutritionist.id } }, step: steps() });
    expect(result).toEqual({ skipped: "cita no existe" });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await db.select().from(waMessages).where(and(eq(waMessages.nutritionistId, f.nutritionist.id), eq(waMessages.patientId, f.patient.id)))).toHaveLength(0);
  });
});

describe("Cuando se cancela una cita", () => {
  it("envía correo al paciente después del WhatsApp, con enlace para volver a agendar", async () => {
    const f = await fixture("ana@example.test", "cancelled");
    const step = steps();
    await handler("appointment-cancelled")({ event: { id: "evt-cancelled", data: { ...f.data, by: "patient" } }, step });
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: f.patient.email, subject: "Tu cita fue cancelada", text: expect.stringContaining(`/${f.nutritionist.slug}/agendar`) }));
    expect(step.run.mock.calls.map(([id]) => id)).toEqual(["cargar-cita", "wa-cita-cancelada", "calendar-cancelled", "email-cita-cancelada-paciente"]);
  });
  it("sin email conserva el WhatsApp y omite el correo", async () => {
    const f = await fixture(null, "cancelled");
    await handler("appointment-cancelled")({ event: { id: "evt-cancelled-no-email", data: { ...f.data, by: "nutritionist" } }, step: steps() });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(await db.select().from(waMessages).where(eq(waMessages.nutritionistId, f.nutritionist.id))).toHaveLength(1);
  });
});
