CREATE TYPE "public"."document_kind" AS ENUM('inbody', 'labs', 'otro');--> statement-breakpoint
CREATE TYPE "public"."parsed_status" AS ENUM('pending', 'ok', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_channel" AS ENUM('whatsapp', 'email');--> statement-breakpoint
CREATE TYPE "public"."report_template" AS ENUM('inbody', 'labs');--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nutritionist_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"kind" "document_kind" NOT NULL,
	"storage_key" text NOT NULL,
	"mime" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"parsed_status" "parsed_status" DEFAULT 'pending' NOT NULL,
	"parsed_json" jsonb,
	"parse_error" text
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"nutritionist_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"template" "report_template" NOT NULL,
	"content" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"interpretation" text DEFAULT '' NOT NULL,
	"brand" jsonb DEFAULT '{"logo_url":null,"color":"#4A7A2B","firma":""}'::jsonb NOT NULL,
	"pdf_storage_key" text,
	"sent_at" timestamp with time zone,
	"sent_via" "report_channel",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_nutritionist_id_nutritionists_id_fk" FOREIGN KEY ("nutritionist_id") REFERENCES "public"."nutritionists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_nutritionist_id_nutritionists_id_fk" FOREIGN KEY ("nutritionist_id") REFERENCES "public"."nutritionists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_nutritionist_patient_idx" ON "documents" USING btree ("nutritionist_id","patient_id");--> statement-breakpoint
CREATE INDEX "reports_nutritionist_patient_idx" ON "reports" USING btree ("nutritionist_id","patient_id");