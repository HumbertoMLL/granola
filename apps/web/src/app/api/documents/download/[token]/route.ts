import { downloadPatientDocument } from "@/lib/documents";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { bytes, mime, url } = await downloadPatientDocument(
      (await params).token,
      true,
    );
    if (url)
      return new Response(null, {
        status: 302,
        headers: {
          Location: url,
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      });
    return new Response(Buffer.from(bytes!), {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `inline; filename="${mime === "application/pdf" ? "reporte.pdf" : "documento"}"`,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; frame-ancestors 'self'; sandbox",
      },
    });
  } catch {
    return Response.json(
      { error: "Enlace inválido, vencido o no disponible." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
}
