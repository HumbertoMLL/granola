import { relations } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { services } from "./services";
import { availabilityOverrides, availabilityRules } from "./availability";
import { patients } from "./patients";
import { appointments } from "./appointments";
import { reviews } from "./reviews";

export const planEnum = pgEnum("plan", ["trial", "starter", "pro", "clinica"]);

// Solo tipos: las listas en runtime viven en apps/web/src/components/public-profile/theme.ts
// para que el cliente no importe drizzle.

/** Ícono opcional de un link de la página pública. */
export type LinkIcon = "instagram" | "tiktok" | "youtube" | "whatsapp" | "web" | "otro";

/** Link libre de la página pública (link-tree). `id` es estable para reordenar/editar. */
export type NutritionistLink = {
  id?: string;
  label: string;
  url: string;
  icon?: LinkIcon | (string & {});
  /** Default true. Un link oculto se conserva pero no se muestra. */
  visible?: boolean;
};

/** Presets de tema de la página pública (tokens en apps/web/src/components/public-profile/theme.ts). */
export type ThemePreset = "avena" | "menta" | "lavanda" | "durazno" | "carbon";

export type ButtonStyle = "pill" | "rounded" | "square";

/** Tema visual de la página pública. Todo opcional: los defaults viven en apps/web. */
export type NutritionistTheme = {
  preset?: ThemePreset;
  buttonStyle?: ButtonStyle;
  /** Botón "Escríbeme por WhatsApp" (requiere phone_wa). Default false. */
  showWhatsApp?: boolean;
  /** Bloque de reseñas verificadas. Default true. */
  showReviews?: boolean;
  /** Legacy (F0): overrides sueltos. Se ignoran si hay `preset`. */
  primary?: string;
  background?: string;
  font?: string;
};

/** Snapshot de `account.requirements` de Stripe Connect (lo que llega en `account.updated`). */
export type StripeRequirements = {
  currentlyDue?: string[];
  eventuallyDue?: string[];
  pastDue?: string[];
  disabledReason?: string | null;
  detailsSubmitted?: boolean;
  /** ISO de la última sincronización (webhook o "Actualizar estado"). */
  syncedAt?: string;
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
    stripeChargesEnabled: boolean("stripe_charges_enabled").notNull().default(false),
    stripePayoutsEnabled: boolean("stripe_payouts_enabled").notNull().default(false),
    stripeRequirements: jsonb("stripe_requirements").$type<StripeRequirements>().notNull().default({}),
    mpUserId: text("mp_user_id"),
    // Cifrado en la capa de aplicación antes de guardar (TODO F1-G Google Calendar).
    googleRefreshTokenEnc: text("google_refresh_token_enc"),
    /** Minutos libres entre citas. */
    bufferMin: integer("buffer_min").notNull().default(0),
    /** Antelación mínima para agendar, en minutos. */
    minNoticeMin: integer("min_notice_min").notNull().default(120),
    /** Cada cuántos minutos se ofrece un horario de inicio. */
    slotStepMin: integer("slot_step_min").notNull().default(30),
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
