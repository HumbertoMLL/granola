import "server-only";
import { z } from "zod";
import {
  and,
  asc,
  auditLog,
  db,
  desc,
  documents,
  eq,
  nutritionists,
  patients,
  reports,
  sql,
} from "./db";
import { documentsReady } from "@granola/db/documents-ready";
import {
  brandSchema,
  contentSchema,
  manualIndicators,
  parseInBody,
  parseLabs,
} from "@granola/core/documents";
import { requireNutritionist } from "./session";
import { getClientIp } from "./request";
import {
  clinicalUploadUrl,
  clinicalDownloadUrl,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIMES,
  matchesMime,
  putClinicalObject,
  readClinicalObject,
  deleteClinicalObject,
} from "./document-storage";
import { signDocumentLink, verifyDocumentLink } from "./document-links";
import { PRESETS, resolveTheme } from "@/components/public-profile/theme";
import { reporteListo, sendEmail } from "@granola/email";
import {
  buildReporteListo,
  createWhatsAppClient,
  sendTemplateAndRecord,
} from "@granola/whatsapp";

export class DocumentError extends Error {}
const idSchema = z.uuid();
async function context() {
  const c = await requireNutritionist();
  if (!(await documentsReady()))
    throw new DocumentError(
      "Documentos estará disponible al aplicar la migración 0006_documents.",
    );
  const ip = z.union([z.ipv4(), z.ipv6()]).safeParse(await getClientIp());
  return { ...c, ip: ip.success ? ip.data : null };
}
type Context = Awaited<ReturnType<typeof context>>;
function audit(c: Context, action: string, entity: string, entityId: string) {
  return db
    .insert(auditLog)
    .values({ actorId: c.user.id, action, entity, entityId, ip: c.ip });
}
async function patientFor(c: Context, patientId: string) {
  const p = await db.query.patients.findFirst({
    where: and(
      eq(patients.id, idSchema.parse(patientId)),
      eq(patients.nutritionistId, c.nutritionist.id),
    ),
  });
  if (!p) throw new DocumentError("Paciente no encontrado");
  if (!p.consentAt || !p.consentIp)
    throw new DocumentError(
      "Registra el consentimiento del paciente antes de continuar.",
    );
  return p;
}
async function documentFor(c: Context, id: string) {
  const d = await db.query.documents.findFirst({
    where: and(
      eq(documents.id, idSchema.parse(id)),
      eq(documents.nutritionistId, c.nutritionist.id),
    ),
  });
  if (!d) throw new DocumentError("Documento no encontrado");
  await patientFor(c, d.patientId);
  await audit(c, "document.read", "document", d.id);
  return d;
}
async function reportFor(c: Context, id: string) {
  const r = await db.query.reports.findFirst({
    where: and(
      eq(reports.id, idSchema.parse(id)),
      eq(reports.nutritionistId, c.nutritionist.id),
    ),
  });
  if (!r) throw new DocumentError("Reporte no encontrado");
  await patientFor(c, r.patientId);
  await audit(c, "report.read", "report", r.id);
  return r;
}
export async function listPatientDocuments(patientId: string) {
  const c = await context();
  await patientFor(c, patientId);
  await audit(c, "documents.read", "patient", patientId);
  return db
    .select({
      id: documents.id,
      kind: documents.kind,
      uploadedAt: documents.uploadedAt,
      parsedStatus: documents.parsedStatus,
      parseError: documents.parseError,
      mime: documents.mime,
    })
    .from(documents)
    .where(
      and(
        eq(documents.patientId, patientId),
        eq(documents.nutritionistId, c.nutritionist.id),
      ),
    )
    .orderBy(desc(documents.uploadedAt));
}
export async function authorizeUpload(patientId: string) {
  const c = await context();
  await patientFor(c, patientId);
}
export async function uploadPatientDocument(input: {
  patientId: string;
  kind: unknown;
  mime: unknown;
  bytes: Uint8Array;
  text: string | null;
  extractionFailed?: boolean;
}) {
  const c = await context();
  const patient = await patientFor(c, input.patientId);
  const kind = z.enum(["inbody", "labs", "otro"]).parse(input.kind);
  const mime = z.enum(DOCUMENT_MIMES).parse(input.mime);
  if (!input.bytes.length || input.bytes.length > DOCUMENT_MAX_BYTES)
    throw new DocumentError("El archivo debe pesar entre 1 byte y 15 MB.");
  if (!matchesMime(input.bytes, mime))
    throw new DocumentError(
      "El contenido no corresponde a un PDF, JPG o PNG válido.",
    );
  const id = crypto.randomUUID();
  const key = `clinical/${c.nutritionist.id}/${id}.${mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg"}`;
  await putClinicalObject(key, input.bytes, mime);
  try {
    await db.batch([
      db.insert(documents).values({
        id,
        patientId: patient.id,
        nutritionistId: c.nutritionist.id,
        kind,
        storageKey: key,
        mime,
        sizeBytes: input.bytes.length,
      }),
      audit(c, "document.create", "document", id),
    ]);
  } catch (e) {
    await deleteClinicalObject(key);
    throw e;
  }
  return recordExtraction(
    c,
    id,
    kind,
    mime,
    input.text,
    input.extractionFailed,
  );
}
async function recordExtraction(
  c: Context,
  id: string,
  kind: "inbody" | "labs" | "otro",
  mime: string,
  text: string | null,
  extractionFailed = false,
) {
  const parsed =
    kind === "inbody"
      ? parseInBody(text ?? "")
      : kind === "labs"
        ? parseLabs(text ?? "")
        : { model: null, indicators: [] };
  const error =
    mime !== "application/pdf"
      ? "Para extraer los datos, sube el PDF. También puedes capturar los indicadores manualmente."
      : extractionFailed
        ? "No se pudo leer el PDF. Sube uno con texto seleccionable o captura los indicadores manualmente."
        : !parsed.indicators.length
          ? "No se encontraron indicadores reconocibles. Revisa el PDF o captura los datos manualmente."
          : null;
  await db.batch([
    db
      .update(documents)
      .set({
        parsedStatus: error ? "failed" : "ok",
        parsedJson: parsed,
        parseError: error,
      })
      .where(
        and(
          eq(documents.id, id),
          eq(documents.nutritionistId, c.nutritionist.id),
        ),
      ),
    audit(c, "document.parse", "document", id),
  ]);
  return { id, parsedStatus: error ? ("failed" as const) : ("ok" as const) };
}
export async function openPatientReport(
  documentId: string,
  template?: unknown,
) {
  const c = await context();
  const d = await documentFor(c, documentId);
  const existing = await db.query.reports.findFirst({
    where: and(
      eq(reports.documentId, d.id),
      eq(reports.nutritionistId, c.nutritionist.id),
      eq(reports.patientId, d.patientId),
    ),
    orderBy: [desc(reports.createdAt)],
  });
  if (existing) {
    await audit(c, "report.read", "report", existing.id);
    return existing;
  }
  const chosen = z
    .enum(["inbody", "labs"])
    .parse(d.kind === "otro" ? template : d.kind);
  const id = crypto.randomUUID();
  const brand = {
    logo_url: c.nutritionist.avatarUrl,
    color: PRESETS[resolveTheme(c.nutritionist.theme).preset].primary,
    firma: [
      c.nutritionist.displayName,
      c.nutritionist.cedula ? `Cédula ${c.nutritionist.cedula}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
  const content = d.parsedJson?.indicators.length
    ? d.parsedJson.indicators
    : manualIndicators(chosen);
  const [rows] = await db.batch([
    db
      .insert(reports)
      .values({
        id,
        documentId: d.id,
        nutritionistId: c.nutritionist.id,
        patientId: d.patientId,
        template: chosen,
        content,
        brand,
      })
      .returning(),
    audit(c, "report.create", "report", id),
  ]);
  return rows[0]!;
}
export const reportEditSchema = z.object({
  id: z.uuid(),
  updatedAt: z.coerce.date(),
  content: contentSchema,
  interpretation: z.string().trim().max(12000),
  brand: brandSchema,
});
export async function savePatientReport(input: unknown) {
  const c = await context();
  const d = reportEditSchema.parse(input);
  const current = await reportFor(c, d.id);
  // La imagen solo puede ser la del perfil; nunca se descarga una URL arbitraria desde el renderizador (SSRF).
  if (
    d.brand.logo_url !== null &&
    d.brand.logo_url !== c.nutritionist.avatarUrl
  )
    throw new DocumentError("Usa el avatar de tu perfil como logo.");
  if (current.updatedAt.getTime() !== d.updatedAt.getTime())
    throw new DocumentError(
      "El reporte cambió. Ciérralo y vuelve a abrirlo para revisar la última versión.",
    );
  const [rows] = await db.batch([
    db
      .update(reports)
      .set({
        content: d.content,
        interpretation: d.interpretation,
        brand: d.brand,
        pdfStorageKey: null,
        sentAt: null,
        sentVia: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(reports.id, d.id),
          eq(reports.nutritionistId, c.nutritionist.id),
          sql`date_trunc('milliseconds', ${reports.updatedAt}) = ${current.updatedAt.toISOString()}::timestamptz`,
        ),
      )
      .returning(),
    audit(c, "report.update", "report", d.id),
  ]);
  if (!rows[0]) throw new DocumentError("El reporte cambió. Vuelve a abrirlo.");
  // Se invalida el enlace anterior antes de borrar el objeto. Nunca se reutilizan keys de PDF.
  if (current.pdfStorageKey) await deleteClinicalObject(current.pdfStorageKey);
  return rows[0];
}
export async function generatePatientReport(id: string) {
  const c = await context();
  const r = await reportFor(c, id);
  const p = await patientFor(c, r.patientId);
  if (!r.content.some((i) => i.visible))
    throw new DocumentError(
      "Elige al menos un indicador visible para generar el PDF.",
    );
  const { renderReport } = await import("./report-pdf");
  const bytes = await renderReport(r, p.name);
  const key = `clinical/${c.nutritionist.id}/${crypto.randomUUID()}.pdf`;
  await putClinicalObject(key, bytes, "application/pdf");
  try {
    const [rows] = await db.batch([
      db
        .update(reports)
        .set({ pdfStorageKey: key })
        .where(
          and(
            eq(reports.id, id),
            eq(reports.nutritionistId, c.nutritionist.id),
            sql`date_trunc('milliseconds', ${reports.updatedAt}) = ${r.updatedAt.toISOString()}::timestamptz`,
          ),
        )
        .returning({ id: reports.id }),
      audit(c, "report.generate", "report", id),
    ]);
    if (!rows.length)
      throw new DocumentError(
        "El reporte cambió durante la generación. Genera el PDF de nuevo.",
      );
  } catch (e) {
    await deleteClinicalObject(key);
    throw e;
  }
  if (r.pdfStorageKey) await deleteClinicalObject(r.pdfStorageKey);
  return { id };
}
export async function patientDocumentLink(
  id: string,
  purpose: "document" | "report",
) {
  const c = await context();
  const row =
    purpose === "document" ? await documentFor(c, id) : await reportFor(c, id);
  const version = "storageKey" in row ? row.storageKey : row.pdfStorageKey;
  if (!version) throw new DocumentError("Primero genera el PDF.");
  return `/api/documents/download/${signDocumentLink({ id, tenant: c.nutritionist.id, patient: row.patientId, purpose, version })}`;
}
export async function sendPatientReport(input: unknown) {
  const d = z
    .object({ id: z.uuid(), via: z.enum(["whatsapp", "email"]) })
    .parse(input);
  const c = await context();
  const r = await reportFor(c, d.id);
  const p = await patientFor(c, r.patientId);
  if (!r.pdfStorageKey)
    throw new DocumentError("Primero genera el PDF de la versión revisada.");
  const token = signDocumentLink({
    id: r.id,
    tenant: c.nutritionist.id,
    patient: p.id,
    purpose: "recipient",
    version: r.pdfStorageKey,
  });
  const base = z
    .url()
    .parse(
      process.env.NEXT_PUBLIC_APP_URL ||
        process.env.BETTER_AUTH_URL ||
        "http://localhost:3000",
    );
  const url = new URL(`/api/documents/download/${token}`, base).href;
  await audit(c, "report.send_requested", "report", r.id);
  let dryRun: boolean;
  if (d.via === "email") {
    if (!p.email)
      throw new DocumentError("El paciente no tiene correo registrado.");
    const result = await sendEmail({
      to: p.email,
      ...reporteListo({
        patientName: p.name,
        nutritionistName: c.nutritionist.displayName,
        reportUrl: url,
      }),
    });
    dryRun = result.dryRun;
  } else {
    if (!p.phoneWa)
      throw new DocumentError("El paciente no tiene WhatsApp registrado.");
    const result = await sendTemplateAndRecord({
      db,
      client: createWhatsAppClient({
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        },
      }),
      nutritionistId: c.nutritionist.id,
      patientId: p.id,
      to: p.phoneWa,
      template: buildReporteListo({
        patientName: p.name,
        nutritionistName: c.nutritionist.displayName,
        token,
      }),
    });
    dryRun = result.result.dryRun;
  }
  await db.batch([
    db
      .update(reports)
      .set({ sentAt: new Date(), sentVia: d.via })
      .where(
        and(
          eq(reports.id, r.id),
          eq(reports.nutritionistId, c.nutritionist.id),
          eq(reports.pdfStorageKey, r.pdfStorageKey),
        ),
      ),
    db.insert(auditLog).values({
      actorId: c.user.id,
      action: "report.send",
      entity: "report",
      entityId: r.id,
      ip: c.ip,
      meta: { via: d.via, dryRun },
    }),
  ]);
  return { dryRun };
}
/** Única lectura sin sesión: capacidad firmada, vinculada a tenant, paciente, versión y propósito. */
export async function downloadPatientDocument(
  token: string,
  redirectToStorage = false,
) {
  const claims = verifyDocumentLink(token);
  if (claims.purpose !== "recipient") {
    const c = await context();
    if (c.nutritionist.id !== claims.tenant)
      throw new DocumentError("Enlace no disponible");
  }
  const n = await db.query.nutritionists.findFirst({
    where: eq(nutritionists.id, claims.tenant),
    columns: { deletedAt: true },
  });
  const p = await db.query.patients.findFirst({
    where: and(
      eq(patients.id, claims.patient),
      eq(patients.nutritionistId, claims.tenant),
    ),
    columns: { consentAt: true, consentIp: true },
  });
  if (!n || n.deletedAt || !p?.consentAt || !p.consentIp)
    throw new DocumentError("Enlace no disponible");
  const row =
    claims.purpose === "document"
      ? await db.query.documents.findFirst({
          where: and(
            eq(documents.id, claims.id),
            eq(documents.nutritionistId, claims.tenant),
            eq(documents.patientId, claims.patient),
          ),
        })
      : await db.query.reports.findFirst({
          where: and(
            eq(reports.id, claims.id),
            eq(reports.nutritionistId, claims.tenant),
            eq(reports.patientId, claims.patient),
          ),
        });
  const key = row && ("storageKey" in row ? row.storageKey : row.pdfStorageKey);
  if (!key || key !== claims.version)
    throw new DocumentError("Enlace no disponible");
  await db.insert(auditLog).values({
    actorId:
      claims.purpose === "recipient"
        ? "patient:report-link"
        : (await requireNutritionist()).user.id,
    action: "document.download",
    entity: claims.purpose === "document" ? "document" : "report",
    entityId: claims.id,
  });
  const mime = "mime" in row ? row.mime : "application/pdf";
  const url = redirectToStorage
    ? await clinicalDownloadUrl(
        key,
        Math.floor((claims.exp - Date.now()) / 1000),
      )
    : null;
  return url
    ? { url, mime, bytes: null }
    : { url: null, bytes: await readClinicalObject(key), mime };
}
export async function inbodyEvolution(patientId: string) {
  const c = await context();
  await patientFor(c, patientId);
  await audit(c, "documents.evolution", "patient", patientId);
  const rows = await db.query.documents.findMany({
    where: and(
      eq(documents.patientId, patientId),
      eq(documents.nutritionistId, c.nutritionist.id),
      eq(documents.kind, "inbody"),
    ),
    orderBy: [asc(documents.uploadedAt)],
    with: {
      reports: {
        where: and(
          eq(reports.nutritionistId, c.nutritionist.id),
          eq(reports.patientId, patientId),
        ),
        orderBy: [desc(reports.updatedAt)],
        limit: 1,
      },
    },
  });
  // Solo indicadores revisados en un reporte: un OCR/extractor nunca modifica la antropometría manual.
  return rows.flatMap((row) => {
    const report = row.reports[0];
    if (!report || report.updatedAt.getTime() === report.createdAt.getTime()) return [];
    const value = (key: string) =>
      report.content.find((i) => i.clave === key && i.visible)?.valor.toString() ?? null;
    return [
      {
        id: row.id,
        measuredAt: row.uploadedAt,
        weightKg: value("weight"),
        bodyFatPct: value("body_fat"),
        muscleKg: value("muscle"),
        waistCm: null,
      },
    ];
  });
}

export async function beginPatientUpload(input: unknown) {
  const c = await context();
  const d = z
    .object({
      patientId: z.uuid(),
      kind: z.enum(["inbody", "labs", "otro"]),
      mime: z.enum(DOCUMENT_MIMES),
      sizeBytes: z
        .number()
        .int()
        .positive()
        .max(DOCUMENT_MAX_BYTES, "El archivo supera 15 MB"),
    })
    .parse(input);
  await patientFor(c, d.patientId);
  const id = crypto.randomUUID();
  const key = `clinical/${c.nutritionist.id}/${id}.${d.mime === "application/pdf" ? "pdf" : d.mime === "image/png" ? "png" : "jpg"}`;
  const uploadUrl = await clinicalUploadUrl(key, d.mime, d.sizeBytes);
  if (!uploadUrl) return { mode: "proxy" as const };
  await db.batch([
    db
      .insert(documents)
      .values({ id, ...d, nutritionistId: c.nutritionist.id, storageKey: key }),
    audit(c, "document.create", "document", id),
  ]);
  return { mode: "direct" as const, id, uploadUrl };
}
export async function pendingPatientUpload(id: string) {
  const c = await context();
  return documentFor(c, id);
}
export async function completePatientUpload(input: {
  id: string;
  bytes: Uint8Array;
  text: string | null;
  extractionFailed: boolean;
}) {
  const c = await context();
  const d = await documentFor(c, input.id);
  if (d.parsedStatus !== "pending")
    return { id: d.id, parsedStatus: d.parsedStatus };
  if (
    input.bytes.length !== d.sizeBytes ||
    input.bytes.length > DOCUMENT_MAX_BYTES ||
    !matchesMime(input.bytes, d.mime)
  ) {
    await db.batch([
      db
        .update(documents)
        .set({
          parsedStatus: "failed",
          parseError:
            "El archivo no coincide con el tipo o tamaño autorizado. Sube el estudio de nuevo.",
        })
        .where(
          and(
            eq(documents.id, d.id),
            eq(documents.nutritionistId, c.nutritionist.id),
          ),
        ),
      audit(c, "document.rejected", "document", d.id),
    ]);
    await deleteClinicalObject(d.storageKey);
    throw new DocumentError(
      "El archivo no coincide con el tipo o tamaño autorizado.",
    );
  }
  // Copia validada e inmutable: el PUT firmado nunca puede sobrescribir el original final.
  const ext =
    d.mime === "application/pdf"
      ? "pdf"
      : d.mime === "image/png"
        ? "png"
        : "jpg";
  const key = `clinical/${c.nutritionist.id}/${crypto.randomUUID()}.${ext}`;
  await putClinicalObject(key, input.bytes, d.mime);
  await db.batch([
    db
      .update(documents)
      .set({ storageKey: key })
      .where(
        and(
          eq(documents.id, d.id),
          eq(documents.nutritionistId, c.nutritionist.id),
        ),
      ),
    audit(c, "document.finalize", "document", d.id),
  ]);
  await deleteClinicalObject(d.storageKey);
  return recordExtraction(
    c,
    d.id,
    d.kind,
    d.mime,
    input.text,
    input.extractionFailed,
  );
}
