// Re-pedir contraseña para acciones sensibles (p. ej. borrar la cuenta) sin
// depender de la cookie de sesión. Usa el mismo hasher que Better Auth
// (`better-auth/crypto`, scrypt) contra `accounts.password` del proveedor
// "credential". No configuramos un hasher propio en packages/auth/src/index.ts;
// si algún día se hace, este helper debe usar el mismo.
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { accounts, and, db, eq } from "@granola/db";

export { hashPassword };

/** true si `password` es la contraseña actual del usuario. false si no tiene contraseña (solo Google/magic link). */
export async function verifyUserPassword(userId: string, password: string): Promise<boolean> {
  if (!password || password.length > 128) return false;
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")),
    columns: { password: true },
  });
  if (!account?.password) return false;
  return verifyPassword({ hash: account.password, password });
}

/** El usuario tiene contraseña (cuenta "credential"). */
export async function hasPassword(userId: string): Promise<boolean> {
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.providerId, "credential")),
    columns: { password: true },
  });
  return Boolean(account?.password);
}
