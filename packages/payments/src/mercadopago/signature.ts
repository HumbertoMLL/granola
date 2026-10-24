import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validación de `x-signature` de Mercado Pago (sin IO, testeable).
 *
 * MP firma: HMAC-SHA256(secret, "id:{data.id};request-id:{x-request-id};ts:{ts};")
 * - `data.id` viene en la query (`?data.id=123`) o en el body (`data.id`); si es
 *   alfanumérico se pasa a minúsculas (así lo documenta MP).
 * - Cada parte se omite del manifest si no viene.
 * - El header `x-signature` tiene forma `ts=1700000000,v1=<hex>`.
 */
export type MpSignatureParts = {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
};

export type MpSignatureResult =
  | { valid: true; ts: number }
  | { valid: false; reason: "missing_header" | "malformed_header" | "mismatch" | "stale" };

export function parseXSignature(header: string): { ts: string; v1: string } | null {
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((kv) => kv.trim().split("=", 2) as [string, string | undefined])
      .filter(([k, v]) => k && v)
      .map(([k, v]) => [k.trim(), (v ?? "").trim()]),
  ) as Record<string, string>;
  if (!parts.ts || !parts.v1) return null;
  return { ts: parts.ts, v1: parts.v1 };
}

export function buildMpManifest(dataId: string | null, requestId: string | null, ts: string): string {
  let manifest = "";
  if (dataId) {
    const normalized = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
    manifest += `id:${normalized};`;
  }
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  return manifest;
}

export function signMpManifest(secret: string, manifest: string): string {
  return createHmac("sha256", secret).update(manifest).digest("hex");
}

/** Ventana de tolerancia por defecto: 5 min (MP reintenta durante horas, pero cada intento refirma). */
const DEFAULT_TOLERANCE_MS = 5 * 60 * 1000;

export function verifyMpSignature(
  parts: MpSignatureParts,
  secret: string,
  opts: { now?: number; toleranceMs?: number | null } = {},
): MpSignatureResult {
  if (!parts.xSignature) return { valid: false, reason: "missing_header" };
  const parsed = parseXSignature(parts.xSignature);
  if (!parsed) return { valid: false, reason: "malformed_header" };

  const expected = signMpManifest(secret, buildMpManifest(parts.dataId, parts.xRequestId, parsed.ts));
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(parsed.v1, "hex");
  if (a.length === 0 || a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "mismatch" };
  }

  const tolerance = opts.toleranceMs === undefined ? DEFAULT_TOLERANCE_MS : opts.toleranceMs;
  if (tolerance !== null) {
    const tsMs = Number(parsed.ts) * (parsed.ts.length > 10 ? 1 : 1000);
    const now = opts.now ?? Date.now();
    if (!Number.isFinite(tsMs) || Math.abs(now - tsMs) > tolerance) return { valid: false, reason: "stale" };
  }

  return { valid: true, ts: Number(parsed.ts) };
}
