import { DeleteObjectsCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

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
export async function deleteR2Prefix(prefix: string): Promise<{ deleted: number } | { skipped: "r2-no-configurado" }> {
  const cfg = readConfig();
  if (!cfg) return { skipped: "r2-no-configurado" };
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  let deleted = 0;
  let token: string | undefined;
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: cfg.bucket, Prefix: prefix, ContinuationToken: token }),
    );
    const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
    if (keys.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: cfg.bucket, Delete: { Objects: keys, Quiet: true } }));
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
