import { DocumentError } from "./documents";
import { StorageNotConfiguredError } from "./storage";
import { z } from "zod";
export function documentHttpError(e: unknown) {
  return Response.json(
    {
      error:
        e instanceof DocumentError || e instanceof StorageNotConfiguredError
          ? e.message
          : e instanceof z.ZodError
            ? "Revisa los campos del documento."
            : "No se pudo procesar el documento.",
    },
    { status: 400, headers: { "Cache-Control": "no-store" } },
  );
}

export function validateDocumentOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new Set([
    new URL(request.url).origin,
    ...[process.env.NEXT_PUBLIC_APP_URL, process.env.BETTER_AUTH_URL].flatMap(
      (url) => (url ? [new URL(url).origin] : []),
    ),
  ]);
  if (origin && !allowed.has(origin))
    throw new DocumentError("Origen de solicitud inválido");
}
