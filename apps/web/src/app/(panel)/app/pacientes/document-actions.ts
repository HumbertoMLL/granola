"use server";
import { z } from "zod";
import {
  DocumentError,
  listPatientDocuments,
  openPatientReport,
  savePatientReport,
  patientDocumentLink,
  sendPatientReport,
  inbodyEvolution,
} from "@/lib/documents";
import { StorageNotConfiguredError } from "@/lib/storage";
async function safely<T>(fn: () => Promise<T>) {
  try {
    return { ok: true as const, data: await fn() };
  } catch (e) {
    return {
      ok: false as const,
      error:
        e instanceof DocumentError || e instanceof StorageNotConfiguredError
          ? e.message
          : e instanceof z.ZodError
            ? (e.issues[0]?.message ?? "Revisa los campos")
            : "No se pudo completar la operación. Intenta de nuevo.",
    };
  }
}
export async function listDocuments(patientId: string) {
  return safely(() => listPatientDocuments(patientId));
}
export async function openReport(
  documentId: string,
  template?: "inbody" | "labs",
) {
  return safely(() => openPatientReport(documentId, template));
}
export async function saveReport(input: unknown) {
  return safely(() => savePatientReport(input));
}
export async function downloadLink(id: string, purpose: "document" | "report") {
  return safely(() =>
    patientDocumentLink(id, z.enum(["document", "report"]).parse(purpose)),
  );
}
export async function sendReport(input: unknown) {
  return safely(() => sendPatientReport(input));
}
export async function getInbodyEvolution(patientId: string) {
  return safely(() => inbodyEvolution(patientId));
}
