import { describe, expect, it } from "vitest";
import { measurementSchema, noteSchema, patientSchema } from "./schemas";

describe("fronteras de expediente", () => {
  const patient = { name: "Ana López", phoneWa: "+525511111111", consent: true };
  it("exige consentimiento expreso y WhatsApp internacional", () => {
    expect(patientSchema.safeParse(patient).success).toBe(true);
    for (const consent of [false, undefined, "true", 1]) {
      expect(patientSchema.safeParse({ ...patient, consent }).success).toBe(false);
    }
    expect(patientSchema.safeParse({ ...patient, phoneWa: "5511111111" }).success).toBe(false);
  });
  it("rechaza fechas imposibles y correos inválidos", () => {
    expect(patientSchema.safeParse({ ...patient, birthDate: "2025-02-30" }).success).toBe(false);
    expect(patientSchema.safeParse({ ...patient, email: "no-es-correo" }).success).toBe(false);
  });
  const measurement = { measuredAt: "2026-10-24T18:00:00Z", weightKg: "70.25", heightCm: "170.5", waistCm: "", hipCm: "", bodyFatPct: "0", muscleKg: "", notes: "" };
  it("conserva decimales y convierte vacíos a null sin volverlos cero", () => {
    expect(measurementSchema.parse(measurement)).toMatchObject({ weightKg: "70.25", waistCm: null, bodyFatPct: "0" });
  });
  it.each([{ weightKg: "0" }, { weightKg: "-1" }, { weightKg: "NaN" }, { weightKg: "70.251" }, { heightCm: "170.25" }, { bodyFatPct: "100.01" }, { measuredAt: "ayer" }])("rechaza datos inválidos %j", (patch) => {
    expect(measurementSchema.safeParse({ ...measurement, ...patch }).success).toBe(false);
  });
  it("exige al menos una medición", () => {
    expect(measurementSchema.safeParse({ ...measurement, weightKg: "", heightCm: "", bodyFatPct: "" }).success).toBe(false);
  });
  it("valida tipo, texto y cita opcional de las notas", () => {
    expect(noteSchema.parse({ kind: "nota", body: " Antecedentes ", appointmentId: null }).body).toBe("Antecedentes");
    expect(noteSchema.safeParse({ kind: "consulta", body: " ", appointmentId: null }).success).toBe(false);
    expect(noteSchema.safeParse({ kind: "inventado", body: "Texto", appointmentId: null }).success).toBe(false);
    expect(noteSchema.safeParse({ kind: "consulta", body: "Texto", appointmentId: "otro-tenant" }).success).toBe(false);
  });
});
