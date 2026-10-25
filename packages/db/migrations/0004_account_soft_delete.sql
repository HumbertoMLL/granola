ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nutritionists" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nutritionists" ADD COLUMN "deletion_scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "nutritionists" ADD COLUMN "purged_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "nutritionists_deletion_due_idx" ON "nutritionists" USING btree ("deletion_scheduled_for") WHERE "nutritionists"."deleted_at" IS NOT NULL AND "nutritionists"."purged_at" IS NULL;