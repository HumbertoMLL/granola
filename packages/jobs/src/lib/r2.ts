import { rm } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Borrado en Cloudflare R2 para el purge de cuentas. Mismas variables que
 * apps/web/src/lib/storage.ts (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET). Sin ellas no hace nada (Twelve-Factor IV:
 * el backing service se desactiva quitando la var).
 */
function readConfig() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/** Borra todos los objetos bajo `prefix`. Devuelve cuántos borró, o `skipped` sin R2. */
export async function deleteR2Prefix(
  prefix: string,
  bucket?: string,
): Promise<{ deleted: number } | { skipped: "r2-no-configurado" }> {
  const cfg = readConfig();
  if (!cfg) return { skipped: "r2-no-configurado" };
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  });
  if (bucket) cfg.bucket = bucket;
  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: cfg.bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    const keys = (page.Contents ?? []).flatMap((o) =>
      o.Key ? [{ Key: o.Key }] : [],
    );
    if (keys.length > 0) {
      const result = await s3.send(
        new DeleteObjectsCommand({
          Bucket: cfg.bucket,
          Delete: { Objects: keys, Quiet: true },
        }),
      );
      if (result.Errors?.length)
        throw new Error("No se pudieron borrar todos los archivos de R2");
      deleted += keys.length;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return { deleted };
}

/** Prefijo de avatares de una nutri (ver `avatarKey()` en apps/web/src/lib/storage.ts). */
export function avatarPrefix(nutritionistId: string): string {
  return `avatars/${nutritionistId}/`;
}

/** Archivos clínicos privados, incluidos PDFs versionados. Local solo existe en desarrollo. */
export async function deleteClinicalFiles(nutritionistId: string) {
  if (!/^[a-f0-9-]{36}$/.test(nutritionistId))
    throw new Error("Tenant inválido");
  const bucket = process.env.R2_PRIVATE_BUCKET;
  if (readConfig() && (!bucket || bucket === process.env.R2_BUCKET))
    throw new Error(
      "Configura el bucket privado de documentos antes del purge",
    );
  const result = await deleteR2Prefix(`clinical/${nutritionistId}/`, bucket);
  if ("skipped" in result && process.env.NODE_ENV === "development") {
    await rm(path.join(process.cwd(), ".uploads", "clinical", nutritionistId), {
      recursive: true,
      force: true,
    });
  }
  return result;
}
