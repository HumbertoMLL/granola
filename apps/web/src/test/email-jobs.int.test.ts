import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { and, db, eq, waMessages } from "@granola/db";
import { seedAppointment, seedNutritionist, seedPatient } from "@granola/db/testing";
import { sendEmail } from "@granola/email";

// Inngest es la frontera externa: ejecutamos cada callback de step una sola vez,
// sin esperar horas ni contactar su servicio. Las queries y los WhatsApp dry-run usan DB real.
type Steps = {
  run: (id: string, action: () => unknown) => Promise<unknown>;
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
afterEach(() => { vi.unstubAllEnvs(); });

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
    expect(ids).toContain("email-nueva-cita-nutri");
    const rows = await db.select().from(waMessages).where(eq(waMessages.nutritionistId, f.nutritionist.id));
    expect(rows).toHaveLength(2);
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
