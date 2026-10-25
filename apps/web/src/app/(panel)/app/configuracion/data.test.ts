import { describe, expect, it } from "vitest";
import type { appointments, nutritionists, patients, services } from "@granola/db/schema";
import { accountDeletionScope, buildAccountExport } from "./data";

const now = new Date("2026-10-24T12:00:00Z");
const nutritionist = {
  id: "nutri-a", userId: "user-a", displayName: "Karla", slug: "karla",
  timezone: "America/Mexico_City", theme: { preset: "menta", notifyNewBooking: false }, links: [],
  googleRefreshTokenEnc: "secret-oauth", stripeAccountId: "acct_private", stripeRequirements: { disabledReason: "private" },
  createdAt: now,
} as unknown as typeof nutritionists.$inferSelect;
const ownService = { id: "service-a", nutritionistId: "nutri-a", priceCents: 65000 } as typeof services.$inferSelect;
const ownPatient = { id: "patient-a", nutritionistId: "nutri-a", name: "Paciente", notes: "Datos del expediente", consentAt: now } as typeof patients.$inferSelect;
const ownAppointment = { id: "appt-a", nutritionistId: "nutri-a", patientId: "patient-a", serviceId: "service-a", startsAt: now, endsAt: now, cancelToken: "secret-cancel", googleEventId: "private-event", notes: "Consulta" } as typeof appointments.$inferSelect;

function exported() {
  return buildAccountExport({ nutritionist, email: "karla@example.com", services: [ownService, { ...ownService, id: "service-b", nutritionistId: "nutri-b" }], patients: [ownPatient, { ...ownPatient, id: "patient-b", nutritionistId: "nutri-b" }], appointments: [ownAppointment, { ...ownAppointment, id: "appt-b", nutritionistId: "nutri-b" }] }, now);
}

describe("exportación de cuenta", () => {
  it("incluye los cuatro dominios y elimina filas de otro nutriólogo", () => {
    const result = exported();
    expect(result.services).toEqual([ownService]);
    expect(result.patients).toEqual([ownPatient]);
    expect(result.appointments.map((a) => a.id)).toEqual(["appt-a"]);
    expect(result.nutritionist.email).toBe("karla@example.com");
    expect(result.exportedAt).toBe(now.toISOString());
  });
  it("excluye credenciales y tokens de acceso sin perder datos del expediente", () => {
    const json = JSON.stringify(exported());
    expect(json).not.toMatch(/secret-|private-event|acct_private|stripeRequirements|googleRefreshTokenEnc|cancelToken/);
    expect(json).toContain("Datos del expediente");
    expect(json).toContain("Consulta");
    expect(JSON.parse(json).patients[0].consentAt).toBe(now.toISOString());
    expect(exported().nutritionist.theme).toEqual(nutritionist.theme);
  });
  it("permite una cuenta sin servicios, pacientes ni citas", () => {
    const result = buildAccountExport({ nutritionist, email: "a@example.com", services: [], patients: [], appointments: [] }, now);
    expect(result.services).toEqual([]);
    expect(result.patients).toEqual([]);
    expect(result.appointments).toEqual([]);
  });
});

describe("alcance y confirmación del borrado", () => {
  const owner = { nutritionistId: "nutri-a", userId: "user-a" };
  it.each([{}, null, { confirmation: "eliminar" }, { confirmation: " ELIMINAR" }, { confirmation: "" }])("rechaza confirmación inválida: %j", (input) => {
    expect(() => accountDeletionScope(input, owner)).toThrow();
  });
  it("usa solo la identidad de sesión y elimina citas antes de las cascadas", () => {
    expect(accountDeletionScope({ confirmation: "ELIMINAR", userId: "victim", nutritionistId: "other" }, owner)).toEqual([
      { entity: "appointments", nutritionistId: "nutri-a" }, { entity: "users", userId: "user-a" },
    ]);
  });
});
