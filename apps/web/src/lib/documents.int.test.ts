import { readFileSync } from "node:fs";
import { POST as uploadRoute } from "@/app/api/documents/upload/route";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedNutritionist, seedPatient } from "@granola/db/testing";
import {
  auditLog,
  db,
  documents,
  eq,
  nutritionists,
  reports,
  waMessages,
} from "./db";
import { requireNutritionist } from "./session";
import {
  beginPatientUpload,
  pendingPatientUpload,
  completePatientUpload,
  uploadPatientDocument,
  listPatientDocuments,
  openPatientReport,
  savePatientReport,
  generatePatientReport,
  patientDocumentLink,
  downloadPatientDocument,
  sendPatientReport,
  inbodyEvolution,
} from "./documents";
import { signDocumentLink, verifyDocumentLink } from "./document-links";
import {
  clinicalUploadUrl,
  putClinicalObject,
  readClinicalObject,
  deleteClinicalObject,
} from "./document-storage";
import { collectAccountExport } from "@/app/(panel)/app/configuracion/export";
import { purgeAccount } from "@granola/jobs";
vi.mock("./session", () => ({ requireNutritionist: vi.fn() }));
// IO externo: S3, no la DB, parsers, PDF ni el cliente de envío en dry run.
vi.mock("./document-storage", async (original) => ({
  ...(await original<typeof import("./document-storage")>()),
  clinicalUploadUrl: vi.fn().mockResolvedValue(null),
  putClinicalObject: vi.fn().mockResolvedValue(undefined),
  readClinicalObject: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  deleteClinicalObject: vi.fn().mockResolvedValue(undefined),
}));

type Seeded = Awaited<ReturnType<typeof seedNutritionist>>;
let a: Seeded;
let b: Seeded;
let patientId: string;
function login(n: Seeded) {
  vi.mocked(requireNutritionist).mockResolvedValue({
    user: { ...n.user, image: null },
    nutritionist: n.nutritionist,
  });
}
const bytes = Buffer.from("%PDF-1.7\nfixture");
async function upload(kind: "inbody" | "labs" = "inbody") {
  return uploadPatientDocument({
    patientId,
    kind,
    mime: "application/pdf",
    bytes,
    text:
      kind === "inbody"
        ? "InBody 570\nPeso: 72.4 kg\nMasa muscular esquelética: 29 kg\nPGC: 23 %"
        : "Glucosa: 98 mg/dL",
  });
}
beforeEach(async () => {
  a = await seedNutritionist();
  b = await seedNutritionist();
  const p = await seedPatient({
    nutritionistId: a.nutritionist.id,
    email: "ficticio@example.test",
  });
  patientId = p.id;
  login(a);
  vi.mocked(clinicalUploadUrl).mockResolvedValue(null);
  vi.stubEnv(
    "DOCUMENT_LINK_SECRET",
    "document-link-fixture-secret-32-characters-only",
  );
  vi.stubEnv("WA_ACCESS_TOKEN", "");
  vi.stubEnv("RESEND_API_KEY", "");
});
describe("Cuando la nutrióloga sube y personaliza un estudio", () => {
  it("autoriza un PUT privado de 15 MB y valida la copia final en la API", async () => {
    vi.mocked(clinicalUploadUrl).mockResolvedValue(
      "https://private.invalid/signed-put",
    );
    const large = new Uint8Array(15 * 1024 * 1024);
    large.set(bytes);
    const ticket = await beginPatientUpload({
      patientId,
      kind: "inbody",
      mime: "application/pdf",
      sizeBytes: large.length,
    });
    expect(ticket.mode).toBe("direct");
    if (ticket.mode !== "direct") throw new Error("Sin ticket");
    const pending = await pendingPatientUpload(ticket.id);
    expect(pending.parsedStatus).toBe("pending");
    const complete = await completePatientUpload({
      id: ticket.id,
      bytes: large,
      text: "InBody 270\nPeso: 71.5 kg",
      extractionFailed: false,
    });
    expect(complete.parsedStatus).toBe("ok");
    const final = await db.query.documents.findFirst({
      where: eq(documents.id, ticket.id),
    });
    expect(final?.storageKey).not.toBe(pending.storageKey);
    expect(final?.parsedJson?.indicators[0]?.valor).toBe(71.5);
    login(b);
    await expect(pendingPatientUpload(ticket.id)).rejects.toThrow(
      "Documento no encontrado",
    );
  });
  it("rechaza una finalización con bytes diferentes del tamaño firmado", async () => {
    vi.mocked(clinicalUploadUrl).mockResolvedValue(
      "https://private.invalid/signed-put",
    );
    const ticket = await beginPatientUpload({
      patientId,
      kind: "labs",
      mime: "application/pdf",
      sizeBytes: bytes.length + 1,
    });
    if (ticket.mode !== "direct") throw new Error("Sin ticket");
    await expect(
      completePatientUpload({
        id: ticket.id,
        bytes,
        text: null,
        extractionFailed: true,
      }),
    ).rejects.toThrow("no coincide");
    expect((await pendingPatientUpload(ticket.id)).parsedStatus).toBe("failed");
  });
  it("sube un PDF real por route handler y persiste la extracción", async () => {
    const form = new FormData();
    form.set("kind", "inbody");
    form.set(
      "file",
      new File(
        [
          readFileSync(
            new URL("../../e2e/fixtures/inbody.pdf", import.meta.url),
          ),
        ],
        "inbody.pdf",
        { type: "application/pdf" },
      ),
    );
    const response = await uploadRoute(
      new Request(
        `http://localhost/api/documents/upload?patientId=${patientId}`,
        { method: "POST", body: form },
      ),
    );
    expect(response.status).toBe(201);
    const result = (await response.json()) as {
      id: string;
      parsedStatus: string;
    };
    expect(result.parsedStatus).toBe("ok");
    const stored = await db.query.documents.findFirst({
      where: eq(documents.id, result.id),
    });
    expect(stored?.parsedJson?.indicators).toHaveLength(12);
  });
  it("guarda documento y extracción, audita y permite un reporte con visibles/comentarios", async () => {
    const d = await upload();
    expect(d.parsedStatus).toBe("ok");
    const row = await db.query.documents.findFirst({
      where: eq(documents.id, d.id),
    });
    expect(row?.parsedJson?.model).toBe("570");
    const r = await openPatientReport(d.id);
    expect(r.brand.firma).toContain(a.nutritionist.displayName);
    const saved = await savePatientReport({
      ...r,
      content: r.content.map((i, idx) => ({
        ...i,
        visible: idx === 0,
        comentario: idx === 0 ? "Revisado en consulta" : "Oculto",
      })),
      interpretation: "Interpretación ficticia",
    });
    expect(saved.content.filter((i) => i.visible)).toHaveLength(1);
    expect(saved.content[0]?.comentario).toBe("Revisado en consulta");
    const audits = await db.select().from(auditLog);
    expect(audits.map((r) => r.action)).toEqual(
      expect.arrayContaining([
        "document.create",
        "document.parse",
        "document.read",
        "report.create",
        "report.update",
      ]),
    );
  });
  it("marca imágenes failed y ofrece captura manual sin inventar valores", async () => {
    const d = await uploadPatientDocument({
      patientId,
      kind: "labs",
      mime: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      text: null,
    });
    const row = await db.query.documents.findFirst({
      where: eq(documents.id, d.id),
    });
    expect(row?.parseError).toContain("sube el PDF");
    expect(row?.parsedStatus).toBe("failed");
    const r = await openPatientReport(d.id);
    expect(r.content.length).toBe(9);
    expect(r.content.every((i) => !i.visible)).toBe(true);
  });
  it("rechaza exceso de tamaño, mime falso y una imagen/logo arbitraria", async () => {
    await expect(
      uploadPatientDocument({
        patientId,
        kind: "labs",
        mime: "application/pdf",
        bytes: new Uint8Array(15 * 1024 * 1024 + 1),
        text: "",
      }),
    ).rejects.toThrow("15 MB");
    await expect(
      uploadPatientDocument({
        patientId,
        kind: "labs",
        mime: "image/png",
        bytes,
        text: null,
      }),
    ).rejects.toThrow("contenido");
    const d = await upload();
    const r = await openPatientReport(d.id);
    await expect(
      savePatientReport({
        ...r,
        brand: { ...r.brand, logo_url: "http://127.0.0.1/private" },
      }),
    ).rejects.toThrow("avatar");
  });
  it("impide sobreescribir otra edición y revoca el PDF al guardar", async () => {
    const d = await upload();
    const r = await openPatientReport(d.id);
    await generatePatientReport(r.id);
    const url = await patientDocumentLink(r.id, "report");
    await savePatientReport({ ...r, interpretation: "Nueva versión" });
    await expect(
      downloadPatientDocument(url.split("/").pop()!),
    ).rejects.toThrow("Enlace");
    expect(deleteClinicalObject).toHaveBeenCalled();
    await expect(savePatientReport(r)).rejects.toThrow("cambió");
  });
});
describe("Cuando otra nutrióloga intenta acceder", () => {
  it("no lista, abre, edita, genera, envía ni descarga estudios de A", async () => {
    const d = await upload();
    const r = await openPatientReport(d.id);
    const url = await patientDocumentLink(d.id, "document");
    login(b);
    await expect(listPatientDocuments(patientId)).rejects.toThrow(
      "Paciente no encontrado",
    );
    await expect(openPatientReport(d.id)).rejects.toThrow(
      "Documento no encontrado",
    );
    await expect(savePatientReport(r)).rejects.toThrow("Reporte no encontrado");
    await expect(generatePatientReport(r.id)).rejects.toThrow(
      "Reporte no encontrado",
    );
    await expect(sendPatientReport({ id: r.id, via: "email" })).rejects.toThrow(
      "Reporte no encontrado",
    );
    await expect(
      downloadPatientDocument(url.split("/").pop()!),
    ).rejects.toThrow("Enlace");
  });
});
describe("Cuando se generan y comparten PDFs privados", () => {
  it("genera un PDF real y registra WhatsApp/correo en dry run", async () => {
    const d = await upload();
    const r = await openPatientReport(d.id);
    await generatePatientReport(r.id);
    const call = vi.mocked(putClinicalObject).mock.calls.at(-1)!;
    expect(Buffer.from(call[1]).subarray(0, 5).toString()).toBe("%PDF-");
    expect(
      (await sendPatientReport({ id: r.id, via: "whatsapp" })).dryRun,
    ).toBe(true);
    const message = await db.query.waMessages.findFirst({
      where: eq(waMessages.patientId, patientId),
    });
    expect(message).toMatchObject({
      template: "reporte_listo",
      errorCode: "dry_run",
    });
    expect(
      await db.query.reports.findFirst({ where: eq(reports.id, r.id) }),
    ).toMatchObject({ sentVia: "whatsapp", sentAt: expect.any(Date) });
    await sendPatientReport({ id: r.id, via: "email" });
    expect(
      await db.query.reports.findFirst({ where: eq(reports.id, r.id) }),
    ).toMatchObject({ sentVia: "email", sentAt: expect.any(Date) });
  });
  it("vence a los 10 minutos o 7 días, rechaza firma y cambio de tenant", async () => {
    const d = await upload();
    const r = await openPatientReport(d.id);
    await generatePatientReport(r.id);
    const row = (await db.query.reports.findFirst({
      where: eq(reports.id, r.id),
    }))!;
    const input = {
      id: r.id,
      tenant: a.nutritionist.id,
      patient: patientId,
      version: row.pdfStorageKey!,
    };
    const token = signDocumentLink({ ...input, purpose: "report" }, 1000);
    expect(() => verifyDocumentLink(token, 601000)).toThrow("vencido");
    const recipient = signDocumentLink({ ...input, purpose: "recipient" });
    expect(verifyDocumentLink(recipient).exp - Date.now()).toBeGreaterThan(
      6.99 * 86400_000,
    );
    expect(() =>
      verifyDocumentLink(recipient, Date.now() + 7 * 86400_000),
    ).toThrow("vencido");
    await expect(downloadPatientDocument(recipient + "x")).rejects.toThrow(
      "vencido",
    );
    expect((await downloadPatientDocument(recipient)).mime).toBe(
      "application/pdf",
    );
    expect(readClinicalObject).toHaveBeenCalledWith(row.pdfStorageKey);
    await db
      .update(nutritionists)
      .set({ deletedAt: new Date() })
      .where(eq(nutritionists.id, a.nutritionist.id));
    await expect(downloadPatientDocument(recipient)).rejects.toThrow("Enlace");
  });
  it("anonimiza reportes y documentos al purgar solo su cuenta", async () => {
    const d = await upload();
    const r = await openPatientReport(d.id);
    await generatePatientReport(r.id);
    await savePatientReport({
      ...r,
      interpretation: "Texto identificable",
      content: r.content.map((i) => ({
        ...i,
        comentario: "Texto identificable",
      })),
    });
    const past = new Date(Date.now() - 86400_000);
    await db
      .update(nutritionists)
      .set({ deletedAt: past, deletionScheduledFor: past })
      .where(eq(nutritionists.id, a.nutritionist.id));
    expect(await purgeAccount(a.nutritionist.id)).toMatchObject({
      purged: true,
    });
    expect(
      await db.query.documents.findFirst({ where: eq(documents.id, d.id) }),
    ).toMatchObject({ storageKey: "purged", parsedJson: null });
    const cleared = await db.query.reports.findFirst({
      where: eq(reports.id, r.id),
    });
    expect(cleared?.interpretation).toBe("");
    expect(cleared?.content.every((i) => i.comentario === "")).toBe(true);
    expect(cleared?.brand.firma).toBe("");
    expect(
      (
        await db.query.nutritionists.findFirst({
          where: eq(nutritionists.id, b.nutritionist.id),
        })
      )?.purgedAt,
    ).toBeNull();
  });
  it("no permite enviar un borrador sin PDF ni generar sin indicadores visibles", async () => {
    const d = await upload();
    const r = await openPatientReport(d.id);
    await expect(sendPatientReport({ id: r.id, via: "email" })).rejects.toThrow(
      "genera el PDF",
    );
    await savePatientReport({
      ...r,
      content: r.content.map((i) => ({ ...i, visible: false })),
    });
    await expect(generatePatientReport(r.id)).rejects.toThrow("visible");
  });
  it("exporta ambos recursos únicamente para el tenant y conserva evolución", async () => {
    const d = await upload();
    const r = await openPatientReport(d.id);
    await savePatientReport(r);
    await generatePatientReport(r.id);
    const d2 = await upload();
    const r2 = await openPatientReport(d2.id);
    await savePatientReport(r2);
    const exported = await collectAccountExport(
      a.nutritionist.id,
      a.user.email,
    );
    expect(exported.documents).toHaveLength(2);
    expect(exported.reports).toHaveLength(2);
    const other = await collectAccountExport(b.nutritionist.id, b.user.email);
    expect(other.documents).toEqual([]);
    expect(other.reports).toEqual([]);
    expect(await inbodyEvolution(patientId)).toHaveLength(2);
  });
});
