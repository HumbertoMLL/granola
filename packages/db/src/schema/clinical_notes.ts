import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { patients } from "./patients";
import { nutritionists } from "./nutritionists";
import { appointments } from "./appointments";

export const clinicalNoteKind = pgEnum("clinical_note_kind", ["consulta", "nota", "antecedente"]);
export const clinicalNotes = pgTable("clinical_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  patientId: uuid("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  nutritionistId: uuid("nutritionist_id").notNull().references(() => nutritionists.id, { onDelete: "cascade" }),
  appointmentId: uuid("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  kind: clinicalNoteKind("kind").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("clinical_notes_nutritionist_patient_idx").on(t.nutritionistId, t.patientId)]);

export const clinicalNotesRelations = relations(clinicalNotes, ({ one }) => ({
  patient: one(patients, { fields: [clinicalNotes.patientId], references: [patients.id] }),
  nutritionist: one(nutritionists, { fields: [clinicalNotes.nutritionistId], references: [nutritionists.id] }),
  appointment: one(appointments, { fields: [clinicalNotes.appointmentId], references: [appointments.id] }),
}));
