import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type SessionUser } from "@/lib/auth";
import { db, eq, nutritionists } from "@/lib/db";

export type Nutritionist = typeof nutritionists.$inferSelect;

export type NutritionistSession = {
  user: SessionUser;
  nutritionist: Nutritionist;
};

/** Sesión actual o null. No redirige. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Para páginas del panel (/app/*). Lee la sesión, busca el row en `nutritionists`
 * (lo crea si es la primera vez) y devuelve { user, nutritionist }. Si no hay
 * sesión redirige a /login.
 *
 * Toda query posterior debe filtrar por `nutritionist.id` (regla dura #1).
 *
 * Cuenta con borrado pendiente (`deleted_at`, ADR 0015): redirige a
 * /cuenta-eliminada, que es lo único que puede ver. Como todas las páginas y
 * server actions del panel pasan por aquí, ninguna escritura corre en gracia.
 * Solo esa pantalla y `cancelAccountDeletion` usan `allowPendingDeletion`.
 */
export async function requireNutritionist(
  opts: { allowPendingDeletion?: boolean } = {},
): Promise<NutritionistSession> {
  const session = await getSession();
  if (!session) redirect("/login");

  const { user } = session;
  const nutritionist =
    (await db.query.nutritionists.findFirst({ where: eq(nutritionists.userId, user.id) })) ??
    (await createNutritionistFor(user));

  if (nutritionist.deletedAt && !opts.allowPendingDeletion) redirect(PENDING_DELETION_PATH);

  return { user, nutritionist };
}

/** Pantalla única de una cuenta en gracia de borrado. Fuera de /app (su layout pide cuenta activa). */
export const PENDING_DELETION_PATH = "/cuenta-eliminada";

async function createNutritionistFor(user: SessionUser): Promise<Nutritionist> {
  // Slug provisional: parte local del email + sufijo aleatorio. La nutri lo cambia en onboarding.
  const base = slugify(user.email.split("@")[0] ?? "nutri") || "nutri";

  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = `${base}-${randomSuffix()}`;
    const [row] = await db
      .insert(nutritionists)
      .values({
        userId: user.id,
        slug,
        displayName: user.name || base,
        avatarUrl: user.image ?? null,
      })
      .onConflictDoNothing({ target: nutritionists.slug })
      .returning();
    if (row) return row;
  }

  // Carrera improbable: otro request ya lo creó entre el findFirst y el insert.
  const existing = await db.query.nutritionists.findFirst({
    where: eq(nutritionists.userId, user.id),
  });
  if (existing) return existing;
  throw new Error("No se pudo crear el perfil de nutriólogo/a");
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
