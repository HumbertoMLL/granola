// Solo desarrollo: ejecutar después de pnpm db:seed en la DB aislada.
import { config } from "dotenv";
config({ path: "apps/web/.env.local", quiet: true });
const { and, clinicalNotes, db, eq, measurements, nutritionists, patients } = await import("@granola/db");
const nutri = await db.query.nutritionists.findFirst({ where: eq(nutritionists.slug, "karla") });
if (!nutri) throw new Error("Ejecuta pnpm db:seed primero");
const patient = await db.query.patients.findFirst({ where: and(eq(patients.nutritionistId, nutri.id), eq(patients.phoneWa, "+525511111111")) });
if (!patient) throw new Error("Falta Ana en el seed base");
await db.update(patients).set({ birthDate: "1994-03-15", sex: "f" }).where(and(eq(patients.id, patient.id), eq(patients.nutritionistId, nutri.id)));
for (const [id, measuredAt, weightKg, waistCm] of [
  ["f2000000-0000-4000-8000-000000000001", "2026-09-01T16:00:00Z", "72.50", "85.0"],
  ["f2000000-0000-4000-8000-000000000002", "2026-10-01T16:00:00Z", "71.25", "83.5"],
  ["f2000000-0000-4000-8000-000000000003", "2026-10-24T16:00:00Z", "70.25", "82.0"],
]) {
  await db.insert(measurements).values({ id, nutritionistId: nutri.id, patientId: patient.id,
    measuredAt: new Date(measuredAt!), weightKg, waistCm, heightCm: "165.0", hipCm: "98.0", bodyFatPct: "28.50", muscleKg: "24.75", notes: "Dato ficticio de demostración" }).onConflictDoNothing();
}
await db.insert(clinicalNotes).values({ id: "f2000000-0000-4000-8000-000000000004", nutritionistId: nutri.id, patientId: patient.id,
  kind: "antecedente", body: "Expediente de demostración. Sin datos reales de salud." }).onConflictDoNothing();
console.log(`Expediente demo: /app/pacientes/${patient.id}`);
