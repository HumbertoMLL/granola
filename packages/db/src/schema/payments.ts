import { relations } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { appointments } from "./appointments";

export const paymentProviderEnum = pgEnum("payment_provider", ["stripe", "mercadopago", "cash"]);
export const paymentMethodEnum = pgEnum("payment_method", ["card", "spei", "oxxo", "cash"]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "expired",
  "refunded",
]);

// Regla dura #3: webhooks idempotentes → provider_ref único.
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    provider: paymentProviderEnum("provider").notNull(),
    /** payment_intent / preference id / null para efectivo. Único por idempotencia. */
    providerRef: text("provider_ref").unique(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("MXN"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    method: paymentMethodEnum("method").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_appointment_id_idx").on(t.appointmentId)],
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  appointment: one(appointments, { fields: [payments.appointmentId], references: [appointments.id] }),
}));
