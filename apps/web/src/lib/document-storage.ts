import "server-only";
import {
  GetObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  isStorageConfigured,
  putObject,
  StorageNotConfiguredError,
} from "./storage";

export const DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const DOCUMENT_MIMES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;
export type DocumentMime = (typeof DOCUMENT_MIMES)[number];
export function matchesMime(bytes: Uint8Array, mime: string) {
  if (mime === "application/pdf")
    return Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-";
  if (mime === "image/png")
    return Buffer.from(bytes.subarray(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  return (
    mime === "image/jpeg" &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  );
}
function localPath(key: string) {
  if (!/^clinical\/[a-f0-9-]+\/[a-f0-9-]+\.(pdf|jpg|png)$/.test(key))
    throw new Error("Clave de archivo inválida");
  if (process.env.NODE_ENV !== "development")
    throw new StorageNotConfiguredError();
  return path.join(process.cwd(), ".uploads", key);
}
function privateBucket() {
  const bucket = process.env.R2_PRIVATE_BUCKET;
  if (!bucket || bucket === process.env.R2_BUCKET)
    throw new StorageNotConfiguredError(
      "Configura R2_PRIVATE_BUCKET como un bucket privado separado del bucket de avatares.",
    );
  return bucket;
}
function s3() {
  return new S3Client({
    region: "auto",
    requestChecksumCalculation: "WHEN_REQUIRED",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}
export async function putClinicalObject(
  key: string,
  body: Uint8Array,
  contentType: string,
) {
  if (isStorageConfigured()) {
    await putObject({
      key,
      body,
      contentType,
      cacheControl: "private, no-store",
      bucket: privateBucket(),
    });
  } else {
    const file = localPath(key);
    await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
    await writeFile(file, body, { mode: 0o600 });
  }
}
export async function readClinicalObject(key: string): Promise<Uint8Array> {
  if (!isStorageConfigured()) return readFile(localPath(key));
  const result = await s3().send(
    new GetObjectCommand({ Bucket: privateBucket(), Key: key }),
  );
  if ((result.ContentLength ?? 0) > DOCUMENT_MAX_BYTES)
    throw new Error("El archivo supera 15 MB");
  if (!result.Body) throw new Error("Archivo no disponible");
  return result.Body.transformToByteArray();
}
export async function deleteClinicalObject(key: string) {
  if (!isStorageConfigured()) {
    await unlink(localPath(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOENT") throw e;
    });
    return;
  }
  await s3().send(
    new DeleteObjectCommand({ Bucket: privateBucket(), Key: key }),
  );
}

/** PUT S3 privado: permite hasta 15 MB sin atravesar el límite de cuerpo del hosting. */
export async function clinicalUploadUrl(
  key: string,
  mime: DocumentMime,
  sizeBytes: number,
) {
  if (!isStorageConfigured()) return null;
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: privateBucket(),
      Key: key,
      ContentType: mime,
      ContentLength: sizeBytes,
      CacheControl: "private, no-store",
    }),
    { expiresIn: 600 },
  );
}
export async function clinicalDownloadUrl(key: string, expiresIn: number) {
  if (!isStorageConfigured()) return null;
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: privateBucket(), Key: key }),
    { expiresIn: Math.max(1, Math.min(600, expiresIn)) },
  );
}
