import { relations } from "drizzle-orm";
import { boolean, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { nutritionists } from "./nutritionists";
import { appointments } from "./appointments";

export const modalityEnum = pgEnum("modality", ["online", "presencial", "ambas"]);
export const paymentModeEnum = pgEnum("payment_mode", ["prepaid", "at_visit", "optional"]);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nutritionistId: uuid("nutritionist_id")
      .notNull()
      .references(() => nutritionists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMin: integer("duration_min").notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    currency: text("currency").notNull().default("MXN"),
    modality: modalityEnum("modality").notNull().default("online"),
    location: text("location"),
    isActive: boolean("is_active").notNull().default(true),
    paymentMode: paymentModeEnum("payment_mode").notNull().default("optional"),
    /** Null = consulta individual; N = paquete de N sesiones. */
    packageSessions: integer("package_sessions"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("services_nutritionist_id_idx").on(t.nutritionistId)],
);

export const servicesRelations = relations(services, ({ one, many }) => ({
  nutritionist: one(nutritionists, { fields: [services.nutritionistId], references: [nutritionists.id] }),
  appointments: many(appointments),
}));
