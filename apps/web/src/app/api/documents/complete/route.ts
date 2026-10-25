import { z } from "zod";
import { completePatientUpload, pendingPatientUpload } from "@/lib/documents";
import { readClinicalObject, matchesMime } from "@/lib/document-storage";
import { extractPdfText } from "@/lib/pdf-text";
import { documentHttpError, validateDocumentOrigin } from "@/lib/document-http";
export async function POST(request: Request) {
  try {
    validateDocumentOrigin(request);
    const { id } = z.object({ id: z.uuid() }).parse(await request.json());
    const d = await pendingPatientUpload(id);
    if (d.parsedStatus !== "pending")
      return Response.json({ id: d.id, parsedStatus: d.parsedStatus });
    const bytes = await readClinicalObject(d.storageKey);
    if (bytes.length !== d.sizeBytes || !matchesMime(bytes, d.mime))
      return Response.json(
        await completePatientUpload({
          id,
          bytes,
          text: null,
          extractionFailed: true,
        }),
      );
    const extraction = await extractPdfText(bytes, d.mime, d.kind);
    return Response.json(
      await completePatientUpload({ id, bytes, ...extraction }),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return documentHttpError(e);
  }
}
