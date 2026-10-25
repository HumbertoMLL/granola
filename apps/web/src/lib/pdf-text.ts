import "server-only";
/** IO de PDF solo en servidor; core recibe exclusivamente el texto. */
export async function extractPdfText(
  bytes: Uint8Array,
  mime: string,
  kind: string,
) {
  if (mime !== "application/pdf" || kind === "otro")
    return { text: null, extractionFailed: false };
  try {
    const { getData } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    PDFParse.setWorker(getData());
    const parser = new PDFParse({ data: bytes.slice() });
    try {
      return {
        text: (await parser.getText({ first: 20 })).text,
        extractionFailed: false,
      };
    } finally {
      await parser.destroy();
    }
  } catch {
    return { text: null, extractionFailed: true };
  }
}
