import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { nutritionists } from "./nutritionists";
import { patients } from "./patients";
import { appointments } from "./appointments";

// Reseña verificada: solo se crea tras una cita con status = completed.
export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nutritionistId: uuid("nutritionist_id")
      .notNull()
      .references(() => nutritionists.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id")
      .notNull()
      .unique()
      .references(() => appointments.id, { onDelete: "cascade" }),
    /** 1–5 (validar con zod en la API). */
    rating: integer("rating").notNull(),
    text: text("text"),
    isPublic: boolean("is_public").notNull().default(true),
    verified: boolean("verified").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reviews_nutritionist_id_idx").on(t.nutritionistId),
    index("reviews_patient_id_idx").on(t.patientId),
  ],
);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  nutritionist: one(nutritionists, { fields: [reviews.nutritionistId], references: [nutritionists.id] }),
  patient: one(patients, { fields: [reviews.patientId], references: [patients.id] }),
  appointment: one(appointments, { fields: [reviews.appointmentId], references: [appointments.id] }),
}));
