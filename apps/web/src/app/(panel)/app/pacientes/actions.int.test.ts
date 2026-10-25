import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryTestDb, seedAppointment, seedNutritionist, seedPatient } from "@granola/db/testing";

import { clinicalNotes, db, eq, measurements, patients } from "@/lib/db";
import { requireNutritionist, type NutritionistSession } from "@/lib/session";
import { TEST_CLIENT_IP } from "@/test/next-mocks";

import {
  createClinicalNote,
  createPatient,
  deleteMeasurement,
  getPatientRecord,
  saveMeasurement,
} from "./actions";

// La sesión (Better Auth + cookies) es frontera: decidimos quién está logueada.
vi.mock("@/lib/session", () => ({ requireNutritionist: vi.fn() }));

type Seeded = Awaited<ReturnType<typeof seedNutritionist>>;

function loginAs({ user, nutritionist }: Seeded) {
  const session: NutritionistSession = {
    user: { ...user, image: user.image ?? null },
    nutritionist,
  };
  vi.mocked(requireNutritionist).mockResolvedValue(session);
}

const newPatient = {
  name: "Ana Pérez López",
  phoneWa: "+525512345678",
  email: "",
  birthDate: "",
  sex: "",
  notes: "",
};

const measurementValues = {
  measuredAt: "2026-10-20T10:00:00-06:00",
  weightKg: "70.50",
  heightCm: "165.0",
  waistCm: "",
  hipCm: "",
  bodyFatPct: "",
  muscleKg: "",
  notes: "",
};

async function auditRows(entityId: string) {
  return queryTestDb<{ action: string; actor_id: string; entity: string; ip: string | null }>(
    "SELECT action, actor_id, entity, ip FROM audit_log WHERE entity_id = $1 ORDER BY at",
    [entityId],
  );
}

describe("Cuando una nutrióloga da de alta un paciente", () => {
  let a: Seeded;

  beforeEach(async () => {
    a = await seedNutritionist({ slug: "nutri-a" });
    loginAs(a);
  });

  it("sin consentimiento expreso se rechaza y no se guarda nada", async () => {
    const res = await createPatient({ ...newPatient, consent: false });

    expect(res).toEqual({ ok: false, error: "Se requiere consentimiento expreso para datos de salud" });
    expect(await db.select().from(patients)).toHaveLength(0);
    expect(await queryTestDb("SELECT 1 FROM audit_log")).toHaveLength(0);
  });

  it("con consentimiento guarda consent_at, la IP del request y su registro en audit_log", async () => {
    const before = Date.now();
    const res = await createPatient({ ...newPatient, consent: true });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = await db.query.patients.findFirst({ where: eq(patients.id, res.data.id) });
    expect(row?.nutritionistId).toBe(a.nutritionist.id);
    expect(row?.consentIp).toBe(TEST_CLIENT_IP);
    expect(row?.consentAt.getTime()).toBeGreaterThanOrEqual(before - 5_000);
    expect(await auditRows(res.data.id)).toEqual([
      { action: "patient.create", actor_id: a.user.id, entity: "patient", ip: TEST_CLIENT_IP },
    ]);
  });
});

describe("Cuando una nutrióloga intenta tocar el expediente de un paciente ajeno", () => {
  let a: Seeded;
  let b: Seeded;
  let patientA: Awaited<ReturnType<typeof seedPatient>>;
  let measurementA: string;

  beforeEach(async () => {
    a = await seedNutritionist({ slug: "nutri-a" });
    b = await seedNutritionist({ slug: "nutri-b" });
    patientA = await seedPatient({ nutritionistId: a.nutritionist.id, name: "Paciente de A" });
    loginAs(a);
    const saved = await saveMeasurement({ patientId: patientA.id, values: measurementValues });
    if (!saved.ok) throw new Error(saved.error);
    measurementA = saved.data.id;
    loginAs(b);
  });

  it("no puede leer la ficha ni deja rastro de lectura", async () => {
    const res = await getPatientRecord({ patientId: patientA.id });

    expect(res).toEqual({ ok: false, error: "Paciente no encontrado" });
    expect((await auditRows(patientA.id)).filter((r) => r.action === "patient.read")).toHaveLength(0);
  });

  it("no puede crear una medición", async () => {
    const res = await saveMeasurement({ patientId: patientA.id, values: measurementValues });

    expect(res).toEqual({ ok: false, error: "Paciente no encontrado" });
    const rows = await db.select().from(measurements).where(eq(measurements.patientId, patientA.id));
    expect(rows.map((r) => r.id)).toEqual([measurementA]);
  });

  it("no puede editar ni borrar la medición de A", async () => {
    const edit = await saveMeasurement({
      patientId: patientA.id,
      id: measurementA,
      values: { ...measurementValues, weightKg: "99.00" },
    });
    const del = await deleteMeasurement({ patientId: patientA.id, id: measurementA });

    expect(edit).toEqual({ ok: false, error: "Paciente no encontrado" });
    expect(del).toEqual({ ok: false, error: "Medición no encontrada" });
    const row = await db.query.measurements.findFirst({ where: eq(measurements.id, measurementA) });
    expect(row?.weightKg).toBe("70.50");
    expect((await auditRows(measurementA)).map((r) => r.action)).toEqual(["measurement.create"]);
  });

  it("no puede crear una nota clínica", async () => {
    const res = await createClinicalNote({
      patientId: patientA.id,
      values: { kind: "nota", body: "Intento ajeno", appointmentId: null },
    });

    expect(res).toEqual({ ok: false, error: "Paciente no encontrado" });
    expect(await db.select().from(clinicalNotes)).toHaveLength(0);
  });
});

describe("Cuando una nutrióloga trabaja el expediente de su paciente", () => {
  let a: Seeded;
  let patient: Awaited<ReturnType<typeof seedPatient>>;

  beforeEach(async () => {
    a = await seedNutritionist({ slug: "nutri-a" });
    patient = await seedPatient({ nutritionistId: a.nutritionist.id });
    loginAs(a);
  });

  it("una nota vinculada a la cita de otro paciente se rechaza", async () => {
    const otherPatient = await seedPatient({ nutritionistId: a.nutritionist.id, name: "Otro paciente" });
    const otherAppt = await seedAppointment({ nutritionistId: a.nutritionist.id, patientId: otherPatient.id });

    const res = await createClinicalNote({
      patientId: patient.id,
      values: { kind: "consulta", body: "Nota", appointmentId: otherAppt.id },
    });

    expect(res).toEqual({ ok: false, error: "Cita no encontrada para este paciente" });
    expect(await db.select().from(clinicalNotes)).toHaveLength(0);
  });

  it("una nota vinculada a su propia cita se guarda con su auditoría", async () => {
    const appt = await seedAppointment({ nutritionistId: a.nutritionist.id, patientId: patient.id });

    const res = await createClinicalNote({
      patientId: patient.id,
      values: { kind: "consulta", body: "Consulta de seguimiento", appointmentId: appt.id },
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const note = await db.query.clinicalNotes.findFirst({ where: eq(clinicalNotes.id, res.data.id) });
    expect(note?.appointmentId).toBe(appt.id);
    expect((await auditRows(res.data.id)).map((r) => r.action)).toEqual(["clinical_note.create"]);
  });

  it("crear una medición deja la fila y su audit_log juntas", async () => {
    const res = await saveMeasurement({ patientId: patient.id, values: measurementValues });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const row = await db.query.measurements.findFirst({ where: eq(measurements.id, res.data.id) });
    expect(row).toMatchObject({ patientId: patient.id, nutritionistId: a.nutritionist.id, weightKg: "70.50" });
    expect(await auditRows(res.data.id)).toEqual([
      { action: "measurement.create", actor_id: a.user.id, entity: "measurement", ip: TEST_CLIENT_IP },
    ]);
  });

  it("borrar una medición la elimina y audita el borrado", async () => {
    const saved = await saveMeasurement({ patientId: patient.id, values: measurementValues });
    if (!saved.ok) throw new Error(saved.error);

    expect(await deleteMeasurement({ patientId: patient.id, id: saved.data.id })).toEqual({
      ok: true,
      data: { id: saved.data.id },
    });
    expect(await db.query.measurements.findFirst({ where: eq(measurements.id, saved.data.id) })).toBeUndefined();
    expect((await auditRows(saved.data.id)).map((r) => r.action)).toEqual(["measurement.create", "measurement.delete"]);
  });

  it("abrir la ficha audita la lectura una vez aunque se refresque tras guardar", async () => {
    const first = await getPatientRecord({ patientId: patient.id });
    await saveMeasurement({ patientId: patient.id, values: measurementValues });
    const refreshed = await getPatientRecord({ patientId: patient.id });

    expect(first.ok).toBe(true);
    expect(refreshed.ok && refreshed.data.measurements).toHaveLength(1);
    expect((await auditRows(patient.id)).filter((r) => r.action === "patient.read")).toEqual([
      { action: "patient.read", actor_id: a.user.id, entity: "patient", ip: TEST_CLIENT_IP },
    ]);
  });
});
