"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { and, appointments, asc, auditLog, clinicalNotes, db, desc, eq, measurements, patients, payments, sql } from "@/lib/db";
import { requireNutritionist } from "@/lib/session";
import { measurementSchema, noteSchema, patientSchema, recordRequestSchema } from "@/components/patients/schemas";

// Server actions = frontera API autenticada. Nunca se acepta nutritionist_id del cliente.
async function context() {
  const session = await requireNutritionist();
  const h = await headers();
  const candidate = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  const ip = z.union([z.ipv4(), z.ipv6()]).safeParse(candidate);
  return { ...session, ip: ip.success ? ip.data : null };
}

async function ownedPatient(id: string, nutritionistId: string) {
  return db.query.patients.findFirst({ where: and(eq(patients.id, id), eq(patients.nutritionistId, nutritionistId)) });
}

async function safely<T>(operation: () => Promise<T>) {
  try { return { ok: true as const, data: await operation() }; }
  catch (error) {
    if (error instanceof z.ZodError) return { ok: false as const, error: error.issues[0]?.message ?? "Revisa los campos" };
    // No devuelve SQL ni datos clínicos en errores.
    return { ok: false as const, error: error instanceof RecordError ? error.message : "No se pudo completar la operación. Intenta de nuevo." };
  }
}
class RecordError extends Error {}

export async function listPatients(input: unknown) {
  const c = await context();
  return safely(async () => {
    const search = z.string().trim().max(100).parse(input);
    const term = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    return db.select({ id: patients.id, name: patients.name, phoneWa: patients.phoneWa, email: patients.email })
      .from(patients).where(and(eq(patients.nutritionistId, c.nutritionist.id),
        sql`(${patients.name} ilike ${term} or ${patients.phoneWa} ilike ${term})`))
      .orderBy(asc(patients.name), asc(patients.id)).limit(100);
  });
}

export async function createPatient(input: unknown) {
  const c = await context();
  return safely(async () => {
    const d = patientSchema.parse(input);
    if (!c.ip) throw new RecordError("No se pudo registrar la IP del consentimiento. Intenta de nuevo.");
    if (d.birthDate && d.birthDate > new Date().toISOString().slice(0, 10)) throw new RecordError("La fecha de nacimiento no puede estar en el futuro");
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(patients).values({ id, nutritionistId: c.nutritionist.id, name: d.name, phoneWa: d.phoneWa,
        email: d.email || null, birthDate: d.birthDate || null, sex: d.sex || null, notes: d.notes || null,
        consentAt: new Date(), consentIp: c.ip, source: "manual" }),
      db.insert(auditLog).values({ actorId: c.user.id, action: "patient.create", entity: "patient", entityId: id, ip: c.ip }),
    ]);
    return { id };
  });
}

export async function getPatientRecord(input: unknown) {
  const c = await context();
  return safely(async () => {
    const d = recordRequestSchema.parse(input);
    const patient = await ownedPatient(d.patientId, c.nutritionist.id);
    if (!patient) throw new RecordError("Paciente no encontrado");
    let appointmentId: string | null = null;
    if (d.appointmentId) {
      const appointment = await db.query.appointments.findFirst({ where: and(eq(appointments.id, d.appointmentId),
        eq(appointments.nutritionistId, c.nutritionist.id), eq(appointments.patientId, patient.id)), columns: { id: true } });
      if (!appointment) throw new RecordError("Cita no encontrada para este paciente");
      appointmentId = appointment.id;
    }
    // Falla cerrado: no se entrega el expediente si no se pudo auditar la lectura.
    await db.insert(auditLog).values({ actorId: c.user.id, action: "patient.read", entity: "patient", entityId: patient.id, ip: c.ip });
    const [measurementRows, notes, visits, charges] = await Promise.all([
      db.query.measurements.findMany({ where: and(eq(measurements.nutritionistId, c.nutritionist.id), eq(measurements.patientId, patient.id)), orderBy: [asc(measurements.measuredAt), asc(measurements.id)] }),
      db.query.clinicalNotes.findMany({ where: and(eq(clinicalNotes.nutritionistId, c.nutritionist.id), eq(clinicalNotes.patientId, patient.id)), orderBy: [desc(clinicalNotes.createdAt), desc(clinicalNotes.id)] }),
      db.select({ id: appointments.id, startsAt: appointments.startsAt, status: appointments.status }).from(appointments)
        .where(and(eq(appointments.nutritionistId, c.nutritionist.id), eq(appointments.patientId, patient.id))).orderBy(desc(appointments.startsAt)),
      db.select({ id: payments.id, amountCents: payments.amountCents, currency: payments.currency, status: payments.status, createdAt: payments.createdAt })
        .from(payments).innerJoin(appointments, eq(payments.appointmentId, appointments.id))
        .where(and(eq(appointments.nutritionistId, c.nutritionist.id), eq(appointments.patientId, patient.id))).orderBy(desc(payments.createdAt)),
    ]);
    return { patient, measurements: measurementRows, notes, visits, charges, appointmentId, timezone: c.nutritionist.timezone };
  });
}

export async function saveMeasurement(input: unknown) {
  const c = await context();
  return safely(async () => {
    const { patientId, id, values } = z.object({ patientId: z.uuid(), id: z.uuid().optional(), values: measurementSchema }).parse(input);
    if (!await ownedPatient(patientId, c.nutritionist.id)) throw new RecordError("Paciente no encontrado");
    const measurementId = id ?? crypto.randomUUID();
    const d = values;
    // CTE + auditoría: ambas escrituras son una única sentencia y solo audita filas propias afectadas.
    const change = id ? sql`update measurements set measured_at=${d.measuredAt}::timestamptz,
      weight_kg=${d.weightKg}, height_cm=${d.heightCm}, waist_cm=${d.waistCm}, hip_cm=${d.hipCm},
      body_fat_pct=${d.bodyFatPct}, muscle_kg=${d.muscleKg}, notes=${d.notes || null}
      where id=${id}::uuid and nutritionist_id=${c.nutritionist.id}::uuid and patient_id=${patientId}::uuid returning id`
      : sql`insert into measurements (id, nutritionist_id, patient_id, measured_at, weight_kg, height_cm, waist_cm, hip_cm, body_fat_pct, muscle_kg, notes)
      values (${measurementId}::uuid, ${c.nutritionist.id}::uuid, ${patientId}::uuid, ${d.measuredAt}::timestamptz,
      ${d.weightKg}, ${d.heightCm}, ${d.waistCm}, ${d.hipCm}, ${d.bodyFatPct}, ${d.muscleKg}, ${d.notes || null}) returning id`;
    const result = await db.execute(sql`with changed as (${change}) insert into audit_log (actor_id, action, entity, entity_id, ip)
      select ${c.user.id}, ${id ? "measurement.update" : "measurement.create"}, 'measurement', id, ${c.ip} from changed returning entity_id`);
    if (!result.rows.length) throw new RecordError("Medición no encontrada");
    return { id: measurementId };
  });
}

export async function deleteMeasurement(input: unknown) {
  const c = await context();
  return safely(async () => {
    const d = z.object({ patientId: z.uuid(), id: z.uuid() }).parse(input);
    const result = await db.execute(sql`with changed as (delete from measurements where id=${d.id}::uuid
      and patient_id=${d.patientId}::uuid and nutritionist_id=${c.nutritionist.id}::uuid returning id)
      insert into audit_log (actor_id, action, entity, entity_id, ip)
      select ${c.user.id}, 'measurement.delete', 'measurement', id, ${c.ip} from changed returning entity_id`);
    if (!result.rows.length) throw new RecordError("Medición no encontrada");
    return { id: d.id };
  });
}

export async function createClinicalNote(input: unknown) {
  const c = await context();
  return safely(async () => {
    const d = z.object({ patientId: z.uuid(), values: noteSchema }).parse(input);
    if (!await ownedPatient(d.patientId, c.nutritionist.id)) throw new RecordError("Paciente no encontrado");
    if (d.values.appointmentId) {
      const appointment = await db.query.appointments.findFirst({ where: and(eq(appointments.id, d.values.appointmentId),
        eq(appointments.nutritionistId, c.nutritionist.id), eq(appointments.patientId, d.patientId)), columns: { id: true } });
      if (!appointment) throw new RecordError("Cita no encontrada para este paciente");
    }
    const id = crypto.randomUUID();
    await db.batch([
      db.insert(clinicalNotes).values({ ...d.values, id, patientId: d.patientId, nutritionistId: c.nutritionist.id }),
      db.insert(auditLog).values({ actorId: c.user.id, action: "clinical_note.create", entity: "clinical_note", entityId: id, ip: c.ip }),
    ]);
    return { id };
  });
}
