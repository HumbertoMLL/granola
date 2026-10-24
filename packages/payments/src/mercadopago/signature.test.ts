import { describe, expect, it } from "vitest";

import { buildMpManifest, parseXSignature, signMpManifest, verifyMpSignature } from "./signature";

// Fixture: valores tipo doc de MP. El secret es inventado.
const SECRET = "a1b2c3d4e5f6g7h8i9j0_test_secret";
const TS = "1704908010"; // 2024-01-10T17:33:30Z
const NOW = Number(TS) * 1000 + 30_000; // 30 s después
const REQUEST_ID = "bb56a2f1-6a1d-4b7a-9a3e-2d1f0c9e8b7a";
const DATA_ID = "123456789";

function header(v1: string, ts = TS) {
  return `ts=${ts},v1=${v1}`;
}

describe("parseXSignature", () => {
  it("parsea ts y v1 con espacios", () => {
    expect(parseXSignature("ts=1, v1=abc")).toEqual({ ts: "1", v1: "abc" });
  });
  it("rechaza headers incompletos", () => {
    expect(parseXSignature("ts=1")).toBeNull();
    expect(parseXSignature("")).toBeNull();
    expect(parseXSignature("garbage")).toBeNull();
  });
});

describe("buildMpManifest", () => {
  it("arma id;request-id;ts; en ese orden", () => {
    expect(buildMpManifest(DATA_ID, REQUEST_ID, TS)).toBe(`id:${DATA_ID};request-id:${REQUEST_ID};ts:${TS};`);
  });
  it("omite partes faltantes", () => {
    expect(buildMpManifest(null, null, TS)).toBe(`ts:${TS};`);
    expect(buildMpManifest(DATA_ID, null, TS)).toBe(`id:${DATA_ID};ts:${TS};`);
  });
  it("pasa a minúsculas un data.id alfanumérico", () => {
    expect(buildMpManifest("ABC123", null, TS)).toBe(`id:abc123;ts:${TS};`);
  });
  it("no toca ids con guiones u otros símbolos", () => {
    expect(buildMpManifest("ABC-123", null, TS)).toBe(`id:ABC-123;ts:${TS};`);
  });
});

describe("verifyMpSignature", () => {
  const good = signMpManifest(SECRET, buildMpManifest(DATA_ID, REQUEST_ID, TS));

  it("acepta una firma correcta dentro de la ventana", () => {
    const result = verifyMpSignature(
      { xSignature: header(good), xRequestId: REQUEST_ID, dataId: DATA_ID },
      SECRET,
      { now: NOW },
    );
    expect(result).toEqual({ valid: true, ts: Number(TS) });
  });

  it("rechaza cuando falta el header", () => {
    expect(verifyMpSignature({ xSignature: null, xRequestId: REQUEST_ID, dataId: DATA_ID }, SECRET)).toEqual({
      valid: false,
      reason: "missing_header",
    });
  });

  it("rechaza header malformado", () => {
    expect(verifyMpSignature({ xSignature: "v1=abc", xRequestId: REQUEST_ID, dataId: DATA_ID }, SECRET)).toEqual({
      valid: false,
      reason: "malformed_header",
    });
  });

  it("rechaza con otro secret", () => {
    const result = verifyMpSignature(
      { xSignature: header(good), xRequestId: REQUEST_ID, dataId: DATA_ID },
      "otro-secret",
      { now: NOW },
    );
    expect(result).toEqual({ valid: false, reason: "mismatch" });
  });

  it("rechaza si cambia el data.id (replay con otro pago)", () => {
    const result = verifyMpSignature(
      { xSignature: header(good), xRequestId: REQUEST_ID, dataId: "987654321" },
      SECRET,
      { now: NOW },
    );
    expect(result).toEqual({ valid: false, reason: "mismatch" });
  });

  it("rechaza si cambia el x-request-id", () => {
    const result = verifyMpSignature(
      { xSignature: header(good), xRequestId: "otro-request", dataId: DATA_ID },
      SECRET,
      { now: NOW },
    );
    expect(result).toEqual({ valid: false, reason: "mismatch" });
  });

  it("rechaza v1 de longitud distinta sin lanzar", () => {
    const result = verifyMpSignature(
      { xSignature: header("abcd"), xRequestId: REQUEST_ID, dataId: DATA_ID },
      SECRET,
      { now: NOW },
    );
    expect(result).toEqual({ valid: false, reason: "mismatch" });
  });

  it("rechaza firmas viejas (stale) fuera de la tolerancia", () => {
    const result = verifyMpSignature(
      { xSignature: header(good), xRequestId: REQUEST_ID, dataId: DATA_ID },
      SECRET,
      { now: NOW + 10 * 60 * 1000 },
    );
    expect(result).toEqual({ valid: false, reason: "stale" });
  });

  it("acepta firmas viejas si se desactiva la tolerancia", () => {
    const result = verifyMpSignature(
      { xSignature: header(good), xRequestId: REQUEST_ID, dataId: DATA_ID },
      SECRET,
      { now: NOW + 10 * 60 * 1000, toleranceMs: null },
    );
    expect(result.valid).toBe(true);
  });

  it("firma sin request-id ni data.id (solo ts) también valida", () => {
    const v1 = signMpManifest(SECRET, buildMpManifest(null, null, TS));
    const result = verifyMpSignature({ xSignature: header(v1), xRequestId: null, dataId: null }, SECRET, { now: NOW });
    expect(result.valid).toBe(true);
  });
});
