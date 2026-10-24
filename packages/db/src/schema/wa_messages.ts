import { relations } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { nutritionists } from "./nutritionists";
import { patients } from "./patients";

export const waDirectionEnum = pgEnum("wa_direction", ["outbound", "inbound"]);
export const waStatusEnum = pgEnum("wa_status", ["queued", "sent", "delivered", "read", "failed"]);

// Regla dura #4: todo lo que manda WhatsApp queda aquí.
export const waMessages = pgTable(
  "wa_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nutritionistId: uuid("nutritionist_id")
      .notNull()
      .references(() => nutritionists.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").references(() => patients.id, { onDelete: "set null" }),
    direction: waDirectionEnum("direction").notNull(),
    /** Nombre de plantilla Meta (cita_confirmada, recordatorio_24h…). Null en inbound. */
    template: text("template"),
    /** ID que devuelve Meta (wamid.…). Único por idempotencia de webhooks de status. */
    waMessageId: text("wa_message_id").unique(),
    status: waStatusEnum("status").notNull().default("queued"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("wa_messages_nutritionist_id_idx").on(t.nutritionistId),
    index("wa_messages_patient_id_idx").on(t.patientId),
  ],
);

export const waMessagesRelations = relations(waMessages, ({ one }) => ({
  nutritionist: one(nutritionists, { fields: [waMessages.nutritionistId], references: [nutritionists.id] }),
  patient: one(patients, { fields: [waMessages.patientId], references: [patients.id] }),
}));
