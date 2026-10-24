import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { nutritionists } from "./nutritionists";
import { patients } from "./patients";
import { services } from "./services";
import { payments } from "./payments";
import { reviews } from "./reviews";

/** Una cita concreta es online o presencial; "ambas" solo aplica al servicio. */
export const appointmentModalityEnum = pgEnum("appointment_modality", ["online", "presencial"]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending_payment",
  "confirmed",
  "cancelled",
  "no_show",
  "completed",
]);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nutritionistId: uuid("nutritionist_id")
      .notNull()
      .references(() => nutritionists.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => patients.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatusEnum("status").notNull().default("pending_payment"),
    modality: appointmentModalityEnum("modality").notNull(),
    meetUrl: text("meet_url"),
    googleEventId: text("google_event_id"),
    /** Token opaco para el link de reagendar/cancelar que va en el WhatsApp. */
    cancelToken: text("cancel_token").notNull().unique(),
    reminder24hSentAt: timestamp("reminder_24h_sent_at", { withTimezone: true }),
    reminder2hSentAt: timestamp("reminder_2h_sent_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("appointments_nutritionist_id_starts_at_idx").on(t.nutritionistId, t.startsAt),
    index("appointments_patient_id_idx").on(t.patientId),
    index("appointments_service_id_idx").on(t.serviceId),
    index("appointments_status_idx").on(t.status),
  ],
);

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  nutritionist: one(nutritionists, { fields: [appointments.nutritionistId], references: [nutritionists.id] }),
  patient: one(patients, { fields: [appointments.patientId], references: [patients.id] }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
  payments: many(payments),
  reviews: many(reviews),
}));
