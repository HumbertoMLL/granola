import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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

/**
 * Datos de la transacción del proveedor, guardados al crear el cobro para no
 * consultar la API en cada carga de /pago/[id]. Todo opcional.
 */
export type PaymentProviderData = {
  /** MP: id de /v1/payments. Stripe: id de la Checkout Session. */
  providerId?: string;
  /** SPEI: CLABE a la que transferir. */
  clabe?: string | null;
  /** SPEI: banco receptor. */
  bankName?: string | null;
  /** OXXO: referencia de pago. */
  reference?: string | null;
  /** Ficha/comprobante de MP. */
  ticketUrl?: string | null;
  /** OXXO: código de barras base64. */
  barcodeBase64?: string | null;
  /** Stripe: URL de la Checkout Session. */
  sessionUrl?: string | null;
  /** Stripe: payment_intent (cuando ya existe). */
  paymentIntentId?: string | null;
  /** Último status/status_detail crudo del proveedor (diagnóstico). */
  providerStatus?: string | null;
  providerStatusDetail?: string | null;
};

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
    providerData: jsonb("provider_data").$type<PaymentProviderData>().notNull().default({}),
    /** Por qué quedó `failed`/`expired` (status_detail de MP, tipo de evento de Stripe…). */
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_appointment_id_idx").on(t.appointmentId)],
);

export const paymentsRelations = relations(payments, ({ one }) => ({
  appointment: one(appointments, { fields: [payments.appointmentId], references: [appointments.id] }),
}));
