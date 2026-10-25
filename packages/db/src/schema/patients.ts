import { documents, reports } from "./documents";
import { relations } from "drizzle-orm";
import { date, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { nutritionists } from "./nutritionists";
import { appointments } from "./appointments";
import { reviews } from "./reviews";
import { waMessages } from "./wa_messages";
import { measurements } from "./measurements";
import { clinicalNotes } from "./clinical_notes";

export const sexEnum = pgEnum("sex", ["f", "m", "otro"]);
export const patientSourceEnum = pgEnum("patient_source", ["booking", "manual", "import"]);

// Dato sensible (LFPDPPP): consent_at + consent_ip son obligatorios al crear.
export const patients = pgTable(
  "patients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nutritionistId: uuid("nutritionist_id")
      .notNull()
      .references(() => nutritionists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phoneWa: text("phone_wa"),
    email: text("email"),
    birthDate: date("birth_date"),
    sex: sexEnum("sex"),
    notes: text("notes"),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    consentIp: text("consent_ip").notNull(),
    source: patientSourceEnum("source").notNull().default("booking"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("patients_nutritionist_id_idx").on(t.nutritionistId),
    index("patients_nutritionist_id_phone_wa_idx").on(t.nutritionistId, t.phoneWa),
  ],
);

export const patientsRelations = relations(patients, ({ one, many }) => ({
  nutritionist: one(nutritionists, { fields: [patients.nutritionistId], references: [nutritionists.id] }),
  appointments: many(appointments),
  reviews: many(reviews),
  clinicalNotes: many(clinicalNotes),
  measurements: many(measurements),
  documents: many(documents),
  reports: many(reports),
  waMessages: many(waMessages),
}));
