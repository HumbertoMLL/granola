import "server-only";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Archivos en Cloudflare R2 (API S3). Variables:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 *   R2_PUBLIC_URL  → dominio público del bucket (p. ej. https://media.granola.app).
 *                    Sin él, la URL pública se arma con el endpoint S3 (solo sirve si
 *                    el bucket es público).
 *
 * Sin estas vars `isStorageConfigured()` es false y el panel deshabilita el upload
 * con el mensaje "Configura R2". Nunca guardamos data URLs en la DB.
 */

type StorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
};

function readConfig(): StorageConfig | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  const publicUrl = (
    process.env.R2_PUBLIC_URL ??
    `https://${bucket}.${accountId}.r2.cloudflarestorage.com`
  ).replace(/\/+$/, "");
  return { accountId, accessKeyId, secretAccessKey, bucket, publicUrl };
}

export function isStorageConfigured(): boolean {
  return readConfig() !== null;
}

let _client: S3Client | undefined;

function client(cfg: StorageConfig): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  return _client;
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB (el cliente redimensiona a 512px antes)
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AvatarType = (typeof AVATAR_TYPES)[number];

const EXT: Record<AvatarType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isAvatarType(t: string): t is AvatarType {
  return (AVATAR_TYPES as readonly string[]).includes(t);
}

export function avatarKey(nutritionistId: string, type: AvatarType): string {
  // Key nueva en cada subida: así la URL cambia y no hay cache viejo en CDN/navegador.
  const stamp = Date.now().toString(36);
  return `avatars/${nutritionistId}/${stamp}.${EXT[type]}`;
}

function publicUrlFor(cfg: StorageConfig, key: string): string {
  return `${cfg.publicUrl}/${key}`;
}

/**
 * URL firmada (PUT) para que el navegador suba directo a R2 sin pasar por el
 * server. Requiere CORS en el bucket (AllowedMethods PUT, AllowedOrigins = app).
 */
export async function createSignedUploadUrl(opts: {
  key: string;
  contentType: AvatarType;
  expiresInSeconds?: number;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  const cfg = readConfig();
  if (!cfg) throw new StorageNotConfiguredError();
  const cmd = new PutObjectCommand({
    Bucket: cfg.bucket,
    Key: opts.key,
    ContentType: opts.contentType,
  });
  const uploadUrl = await getSignedUrl(client(cfg), cmd, {
    expiresIn: opts.expiresInSeconds ?? 300,
  });
  return { uploadUrl, publicUrl: publicUrlFor(cfg, opts.key) };
}

/**
 * Subida desde el server (server action con FormData). No necesita CORS en el
 * bucket; es la ruta que usa el editor de Mi página.
 */
export async function putObject(opts: {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
  /** Bucket privado para documentos clínicos; nunca el dominio público de avatares. */
  bucket?: string;
}): Promise<{ publicUrl: string }> {
  const cfg = readConfig();
  if (!cfg) throw new StorageNotConfiguredError();
  await client(cfg).send(
    new PutObjectCommand({
      Bucket: opts.bucket ?? cfg.bucket,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
      CacheControl: opts.cacheControl ?? "public, max-age=31536000, immutable",
    }),
  );
  return { publicUrl: publicUrlFor(cfg, opts.key) };
}

export class StorageNotConfiguredError extends Error {
  constructor(
    message = "Configura R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET).",
  ) {
    super(message);
    this.name = "StorageNotConfiguredError";
  }
}
