import { relations } from "drizzle-orm";
import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { patients } from "./patients";
import { nutritionists } from "./nutritionists";

export const measurements = pgTable(
  "measurements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    nutritionistId: uuid("nutritionist_id")
      .notNull()
      .references(() => nutritionists.id, { onDelete: "cascade" }),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    weightKg: numeric("weight_kg", { precision: 6, scale: 2 }),
    heightCm: numeric("height_cm", { precision: 5, scale: 1 }),
    waistCm: numeric("waist_cm", { precision: 5, scale: 1 }),
    hipCm: numeric("hip_cm", { precision: 5, scale: 1 }),
    bodyFatPct: numeric("body_fat_pct", { precision: 5, scale: 2 }),
    muscleKg: numeric("muscle_kg", { precision: 6, scale: 2 }),
    notes: text("notes"),
  },
  (t) => [index("measurements_nutritionist_patient_idx").on(t.nutritionistId, t.patientId)],
);

export const measurementsRelations = relations(measurements, ({ one }) => ({
  patient: one(patients, { fields: [measurements.patientId], references: [patients.id] }),
  nutritionist: one(nutritionists, { fields: [measurements.nutritionistId], references: [nutritionists.id] }),
}));
