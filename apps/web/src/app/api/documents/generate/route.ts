import { z } from "zod";
import { generatePatientReport } from "@/lib/documents";
import { documentHttpError, validateDocumentOrigin } from "@/lib/document-http";
export async function POST(request: Request) {
  try {
    validateDocumentOrigin(request);
    const { id } = z.object({ id: z.uuid() }).parse(await request.json());
    return Response.json(await generatePatientReport(id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return documentHttpError(e);
  }
}
