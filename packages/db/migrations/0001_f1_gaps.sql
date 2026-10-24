ALTER TABLE "appointments" ADD COLUMN "patient_timezone" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "nutritionists" ADD COLUMN "stripe_charges_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nutritionists" ADD COLUMN "stripe_payouts_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "nutritionists" ADD COLUMN "stripe_requirements" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "nutritionists" ADD COLUMN "buffer_min" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "nutritionists" ADD COLUMN "min_notice_min" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "nutritionists" ADD COLUMN "slot_step_min" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "provider_data" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "failure_reason" text;--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────
-- SQL MANUAL (drizzle-kit no genera exclusion constraints). Ver packages/db/README.md.
-- Impide dos citas que se enciman para la misma nutri mientras ocupan agenda
-- (confirmed / pending_payment). Las canceladas, completadas y no_show no bloquean.
-- `[)` → una cita que termina a las 10:00 no choca con otra que empieza a las 10:00.
-- Error al violarla: SQLSTATE 23P01 (exclusion_violation); createBooking lo traduce
-- a "Ese horario se acaba de ocupar".
-- ─────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_no_overlap" EXCLUDE USING gist (
  "nutritionist_id" WITH =,
  tstzrange("starts_at", "ends_at", '[)') WITH &&
) WHERE ("status" IN ('confirmed', 'pending_payment'));
