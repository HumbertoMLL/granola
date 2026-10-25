import "server-only";

import { slugSchema } from "@/app/(panel)/app/mi-pagina/schema";
import { cacheTagFor } from "@/lib/public-profile";
import type { Nutritionist } from "@/lib/session";
import { and, db, eq, ne, nutritionists, users } from "@/lib/db";
import { updateTag } from "next/cache";
import { z } from "zod";

export const identitySchema = z.object({
  displayName: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  slug: slugSchema,
});

export type IdentityResult = { ok: true; slug: string } | { ok: false; error: string };

/**
 * Cambia nombre público y slug en una sola escritura. No toca `theme`, `links`
 * ni el resto del perfil: así no hay copia vieja que pisar a Mi página.
 * Con `syncUserName` también actualiza `users.name` en el mismo `db.batch`
 * (transacción en neon-http).
 */
export async function saveProfileIdentity(
  n: Pick<Nutritionist, "id" | "userId" | "slug">,
  input: unknown,
  opts: { syncUserName?: boolean } = {},
): Promise<IdentityResult> {
  const parsed = identitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const { displayName, slug } = parsed.data;

  if (slug !== n.slug) {
    const taken = await db.query.nutritionists.findFirst({
      where: and(eq(nutritionists.slug, slug), ne(nutritionists.id, n.id)),
      columns: { id: true },
    });
    if (taken) return { ok: false, error: "Ese link ya está en uso" };
  }

  const now = new Date();
  const updateProfile = db
    .update(nutritionists)
    .set({ displayName, slug, updatedAt: now })
    .where(eq(nutritionists.id, n.id));
  try {
    if (opts.syncUserName) {
      await db.batch([
        updateProfile,
        db.update(users).set({ name: displayName, updatedAt: now }).where(eq(users.id, n.userId)),
      ]);
    } else {
      await updateProfile;
    }
  } catch (err) {
    const msg = err instanceof Error ? `${err.message} ${String(err.cause ?? "")}` : String(err);
    if (/unique|duplicate|23505/i.test(msg)) return { ok: false, error: "Ese link ya está en uso" };
    throw err;
  }

  updateTag(cacheTagFor(n.slug));
  if (slug !== n.slug) updateTag(cacheTagFor(slug));
  return { ok: true, slug };
}
