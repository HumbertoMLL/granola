import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { Indicator, ParsedDocument, ReportBrand } from "@granola/core/documents";
import { nutritionists } from "./nutritionists";
import { patients } from "./patients";

export const documentKind = pgEnum("document_kind", ["inbody", "labs", "otro"]);
export const parsedStatus = pgEnum("parsed_status", ["pending", "ok", "failed"]);
export const reportTemplate = pgEnum("report_template", ["inbody", "labs"]);
export const reportChannel = pgEnum("report_channel", ["whatsapp", "email"]);
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  nutritionistId: uuid("nutritionist_id").notNull().references(() => nutritionists.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  kind: documentKind("kind").notNull(),
  storageKey: text("storage_key").notNull(),
  mime: text("mime").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  parsedStatus: parsedStatus("parsed_status").notNull().default("pending"),
  parsedJson: jsonb("parsed_json").$type<ParsedDocument>(),
  parseError: text("parse_error"),
}, (t) => [index("documents_nutritionist_patient_idx").on(t.nutritionistId, t.patientId)]);
export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").notNull().references(() => documents.id),
  nutritionistId: uuid("nutritionist_id").notNull().references(() => nutritionists.id),
  patientId: uuid("patient_id").notNull().references(() => patients.id),
  template: reportTemplate("template").notNull(),
  content: jsonb("content").$type<Indicator[]>().notNull().default([]),
  interpretation: text("interpretation").notNull().default(""),
  brand: jsonb("brand").$type<ReportBrand>().notNull().default({ logo_url: null, color: "#4A7A2B", firma: "" }),
  pdfStorageKey: text("pdf_storage_key"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentVia: reportChannel("sent_via"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("reports_nutritionist_patient_idx").on(t.nutritionistId, t.patientId)]);
export const documentsRelations = relations(documents, ({ one, many }) => ({
  nutritionist: one(nutritionists, { fields: [documents.nutritionistId], references: [nutritionists.id] }),
  patient: one(patients, { fields: [documents.patientId], references: [patients.id] }), reports: many(reports),
}));
export const reportsRelations = relations(reports, ({ one }) => ({
  document: one(documents, { fields: [reports.documentId], references: [documents.id] }),
  nutritionist: one(nutritionists, { fields: [reports.nutritionistId], references: [nutritionists.id] }),
  patient: one(patients, { fields: [reports.patientId], references: [patients.id] }),
}));
