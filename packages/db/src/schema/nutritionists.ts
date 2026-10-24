import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { services } from "./services";
import { availabilityOverrides, availabilityRules } from "./availability";
import { patients } from "./patients";
import { appointments } from "./appointments";
import { reviews } from "./reviews";

export const planEnum = pgEnum("plan", ["trial", "starter", "pro", "clinica"]);

/** Link libre de la página pública (link-tree). */
export type NutritionistLink = { label: string; url: string; icon?: string };

/** Tema visual de la página pública. Se afina en F1 con packages/ui. */
export type NutritionistTheme = {
  primary?: string;
  background?: string;
  font?: string;
};

export const nutritionists = pgTable(
  "nutritionists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    displayName: text("display_name").notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    cedula: text("cedula"),
    phoneWa: text("phone_wa"),
    timezone: text("timezone").notNull().default("America/Mexico_City"),
    theme: jsonb("theme").$type<NutritionistTheme>().notNull().default({}),
    links: jsonb("links").$type<NutritionistLink[]>().notNull().default([]),
    plan: planEnum("plan").notNull().default("trial"),
    stripeAccountId: text("stripe_account_id"),
    mpUserId: text("mp_user_id"),
    // Cifrado en la capa de aplicación antes de guardar (TODO F1-G Google Calendar).
    googleRefreshTokenEnc: text("google_refresh_token_enc"),
    onboardingStep: integer("onboarding_step").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("nutritionists_slug_idx").on(t.slug)],
);

export const nutritionistsRelations = relations(nutritionists, ({ one, many }) => ({
  user: one(users, { fields: [nutritionists.userId], references: [users.id] }),
  services: many(services),
  availabilityRules: many(availabilityRules),
  availabilityOverrides: many(availabilityOverrides),
  patients: many(patients),
  appointments: many(appointments),
  reviews: many(reviews),
}));
