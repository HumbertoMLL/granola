CREATE TYPE "public"."clinical_note_kind" AS ENUM('consulta', 'nota', 'antecedente');--> statement-breakpoint
CREATE TABLE "clinical_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"nutritionist_id" uuid NOT NULL,
	"appointment_id" uuid,
	"kind" "clinical_note_kind" NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"nutritionist_id" uuid NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"weight_kg" numeric(6, 2),
	"height_cm" numeric(5, 1),
	"waist_cm" numeric(5, 1),
	"hip_cm" numeric(5, 1),
	"body_fat_pct" numeric(5, 2),
	"muscle_kg" numeric(6, 2),
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_nutritionist_id_nutritionists_id_fk" FOREIGN KEY ("nutritionist_id") REFERENCES "public"."nutritionists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_notes" ADD CONSTRAINT "clinical_notes_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_nutritionist_id_nutritionists_id_fk" FOREIGN KEY ("nutritionist_id") REFERENCES "public"."nutritionists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clinical_notes_nutritionist_patient_idx" ON "clinical_notes" USING btree ("nutritionist_id","patient_id");--> statement-breakpoint
CREATE INDEX "measurements_nutritionist_patient_idx" ON "measurements" USING btree ("nutritionist_id","patient_id");