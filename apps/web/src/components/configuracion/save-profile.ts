import "server-only";

import { saveMyPage } from "@/app/(panel)/app/mi-pagina/actions";
import { isLinkIcon, resolveTheme } from "@/components/public-profile/theme";
import type { Nutritionist } from "@/lib/session";
import { db, eq, nutritionists } from "@/lib/db";

/** Adaptador al contrato del editor: reutiliza validación, slug y caché existentes. */
export async function saveProfileIdentity(n: Nutritionist, identity: { displayName: string; slug: string }) {
  const result = await saveMyPage({
    ...identity, bio: n.bio ?? "", cedula: n.cedula ?? "", phoneWa: n.phoneWa ?? "", avatarUrl: n.avatarUrl,
    theme: resolveTheme(n.theme),
    links: n.links.map((l, i) => ({ ...l, id: l.id ?? `link-${i}`, icon: isLinkIcon(l.icon) ? l.icon : "otro", visible: l.visible !== false })),
  });
  if (result.ok) {
    // El contrato del editor normaliza el tema visual. Cambiar identidad debe
    // conservar el JSON original, incluidas preferencias y overrides legacy.
    await db.update(nutritionists).set({ theme: n.theme }).where(eq(nutritionists.id, n.id));
  }
  return result;
}
