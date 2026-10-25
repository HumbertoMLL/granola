import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const claimsSchema = z.object({
  id: z.uuid(),
  tenant: z.uuid(),
  patient: z.uuid(),
  purpose: z.enum(["document", "report", "recipient"]),
  exp: z.number().int(),
  version: z.string().max(200),
});
export type LinkClaims = z.infer<typeof claimsSchema>;
function secret() {
  const key =
    process.env.DOCUMENT_LINK_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!key || key.length < 32)
    throw new Error(
      "Configura DOCUMENT_LINK_SECRET con al menos 32 caracteres para los enlaces privados.",
    );
  return key;
}
export function signDocumentLink(
  input: Omit<LinkClaims, "exp">,
  now = Date.now(),
) {
  const claims = claimsSchema.parse({
    ...input,
    exp: now + (input.purpose === "recipient" ? 7 * 86400_000 : 600_000),
  });
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifyDocumentLink(
  token: string,
  now = Date.now(),
): LinkClaims {
  if (token.length > 2000) throw new Error("Enlace inválido o vencido");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra)
    throw new Error("Enlace inválido o vencido");
  const expected = createHmac("sha256", secret()).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual))
    throw new Error("Enlace inválido o vencido");
  const claims = claimsSchema.parse(
    JSON.parse(Buffer.from(payload, "base64url").toString()),
  );
  const maxLifetime = claims.purpose === "recipient" ? 7 * 86400_000 : 600_000;
  if (claims.exp <= now || claims.exp > now + maxLifetime)
    throw new Error("Enlace inválido o vencido");
  return claims;
}
