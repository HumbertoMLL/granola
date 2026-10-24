import { relations } from "drizzle-orm";
import { boolean, date, index, integer, pgTable, time, timestamp, uuid } from "drizzle-orm/pg-core";
import { nutritionists } from "./nutritionists";

// Horas locales en la zona horaria del nutri (nutritionists.timezone).
// packages/core/scheduling las convierte a UTC al calcular slots.

export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nutritionistId: uuid("nutritionist_id")
      .notNull()
      .references(() => nutritionists.id, { onDelete: "cascade" }),
    /** 0 = domingo … 6 = sábado (convención JS Date.getDay). */
    weekday: integer("weekday").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("availability_rules_nutritionist_id_idx").on(t.nutritionistId)],
);

export const availabilityOverrides = pgTable(
  "availability_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nutritionistId: uuid("nutritionist_id")
      .notNull()
      .references(() => nutritionists.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** Null + isBlocked = día completo bloqueado. Con horas = ventana extra o bloqueo parcial. */
    startTime: time("start_time"),
    endTime: time("end_time"),
    isBlocked: boolean("is_blocked").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("availability_overrides_nutritionist_id_date_idx").on(t.nutritionistId, t.date)],
);

export const availabilityRulesRelations = relations(availabilityRules, ({ one }) => ({
  nutritionist: one(nutritionists, {
    fields: [availabilityRules.nutritionistId],
    references: [nutritionists.id],
  }),
}));

export const availabilityOverridesRelations = relations(availabilityOverrides, ({ one }) => ({
  nutritionist: one(nutritionists, {
    fields: [availabilityOverrides.nutritionistId],
    references: [nutritionists.id],
  }),
}));
