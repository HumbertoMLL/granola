import { beginPatientUpload } from "@/lib/documents";
import { documentHttpError, validateDocumentOrigin } from "@/lib/document-http";
export async function POST(request: Request) {
  try {
    validateDocumentOrigin(request);
    return Response.json(await beginPatientUpload(await request.json()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return documentHttpError(e);
  }
}
