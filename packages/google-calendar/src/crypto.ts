import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";

function key(): Buffer {
  const encoded = z.string().regex(/^[A-Za-z0-9+/]{43}=$/).parse(process.env.GOOGLE_TOKEN_ENC_KEY);
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length !== 32) throw new Error("GOOGLE_TOKEN_ENC_KEY debe contener 32 bytes en base64");
  return bytes;
}

/** Envelope versionado: nonce aleatorio de 96 bits + tag autenticado de 128 bits. */
export function encryptRefreshToken(token: string): string {
  z.string().min(1).parse(token);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from("granola:google-refresh-token:v1"));
  const data = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptRefreshToken(envelope: string): string {
  const [version, iv, tag, data] = z.tuple([z.literal("v1"), z.string(), z.string(), z.string()]).parse(envelope.split(":"));
  const nonce = Buffer.from(iv, "base64");
  const authTag = Buffer.from(tag, "base64");
  if (version !== "v1" || nonce.length !== 12 || authTag.length !== 16) throw new Error("Token cifrado inválido");
  const cipher = createDecipheriv("aes-256-gcm", key(), nonce);
  cipher.setAAD(Buffer.from("granola:google-refresh-token:v1"));
  cipher.setAuthTag(authTag);
  return Buffer.concat([cipher.update(Buffer.from(data, "base64")), cipher.final()]).toString("utf8");
}
