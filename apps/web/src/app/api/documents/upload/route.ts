import { extractPdfText } from "@/lib/pdf-text";
import { z } from "zod";
import {
  authorizeUpload,
  DocumentError,
  uploadPatientDocument,
} from "@/lib/documents";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIMES,
  matchesMime,
} from "@/lib/document-storage";
import { documentHttpError, validateDocumentOrigin } from "@/lib/document-http";

export async function POST(request: Request) {
  try {
    validateDocumentOrigin(request);
    const patientId = z
      .uuid()
      .parse(new URL(request.url).searchParams.get("patientId"));
    await authorizeUpload(patientId);
    // Acota el cuerpo real, incluso sin Content-Length o con un header falso.
    const reader = request.body?.getReader();
    if (!reader) throw new DocumentError("Selecciona un archivo");
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > DOCUMENT_MAX_BYTES + 64 * 1024) {
        await reader.cancel();
        throw new DocumentError("El archivo supera 15 MB.");
      }
      chunks.push(value);
    }
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") ?? "" },
      body: Buffer.concat(chunks),
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > DOCUMENT_MAX_BYTES || !file.size)
      throw new DocumentError("Selecciona un PDF, JPG o PNG de hasta 15 MB.");
    const mime = z.enum(DOCUMENT_MIMES).parse(file.type);
    const kind = z.enum(["inbody", "labs", "otro"]).parse(form.get("kind"));
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesMime(bytes, mime))
      throw new DocumentError(
        "El contenido no corresponde al tipo de archivo.",
      );
    const { text, extractionFailed } = await extractPdfText(bytes, mime, kind);
    return Response.json(
      await uploadPatientDocument({
        patientId,
        kind,
        mime,
        bytes,
        text,
        extractionFailed,
      }),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return documentHttpError(e);
  }
}
