import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue({}) }));
vi.mock("server-only", () => ({}));
vi.mock("@aws-sdk/client-s3", async (original) => ({
  ...(await original<typeof import("@aws-sdk/client-s3")>()),
  S3Client: class {
    send = send;
  },
}));
import {
  clinicalUploadUrl,
  putClinicalObject,
  readClinicalObject,
  deleteClinicalObject,
} from "./document-storage";
const key =
  "clinical/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.pdf";
beforeEach(() => {
  for (const name of [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PRIVATE_BUCKET",
  ])
    vi.stubEnv(name, "");
  send.mockClear();
});
afterEach(() => vi.unstubAllEnvs());
describe("Al almacenar estudios clínicos", () => {
  it("falla en producción sin R2, nunca escribe un fallback local", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(clinicalUploadUrl(key, "application/pdf", 15 * 1024 * 1024)).rejects.toThrow("Configura R2");
    await expect(
      putClinicalObject(key, Buffer.from("%PDF-1.7"), "application/pdf"),
    ).rejects.toThrow("Configura R2");
    await expect(readClinicalObject(key)).rejects.toThrow("Configura R2");
  });
  it("permite guardar, leer y borrar localmente solo en desarrollo", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const bytes = Buffer.from("%PDF-fixture");
    await putClinicalObject(key, bytes, "application/pdf");
    expect(Buffer.from(await readClinicalObject(key))).toEqual(bytes);
    await deleteClinicalObject(key);
    await expect(readClinicalObject(key)).rejects.toThrow();
    await expect(
      putClinicalObject("../../outside.pdf", bytes, "application/pdf"),
    ).rejects.toThrow("Clave");
  });
  it("usa exclusivamente el bucket privado y Cache-Control privado", async () => {
    vi.stubEnv("R2_ACCOUNT_ID", "test");
    vi.stubEnv("R2_ACCESS_KEY_ID", "test");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "test");
    vi.stubEnv("R2_BUCKET", "public-avatars");
    vi.stubEnv("R2_PRIVATE_BUCKET", "private-clinical");
    await putClinicalObject(key, Buffer.from("%PDF-1.7"), "application/pdf");
    expect(send.mock.calls[0]?.[0].input).toMatchObject({
      Bucket: "private-clinical",
      CacheControl: "private, no-store",
    });
    vi.stubEnv("R2_PRIVATE_BUCKET", "public-avatars");
    await expect(
      putClinicalObject(key, Buffer.from("%PDF-1.7"), "application/pdf"),
    ).rejects.toThrow("bucket privado");
  });
});
