"use server";

import { updateTag } from "next/cache";
import { z } from "zod";

import { and, db, eq, ne, nutritionists } from "@/lib/db";
import { cacheTagFor, isReservedSlug } from "@/lib/public-profile";
import { requireNutritionist } from "@/lib/session";
import {
  AVATAR_MAX_BYTES,
  avatarKey,
  isAvatarType,
  isStorageConfigured,
  putObject,
  StorageNotConfiguredError,
} from "@/lib/storage";
import type { NutritionistLink, NutritionistTheme } from "@granola/db/schema";

import { myPageSchema, slugSchema, type SaveResult } from "./schema";

/* ------------------------------- Actions ------------------------------- */

export type SlugStatus = "ok" | "current" | "taken" | "reserved" | "invalid";

/** Disponibilidad del slug para la nutri en sesión. */
export async function checkSlug(raw: string): Promise<SlugStatus> {
  const { nutritionist } = await requireNutritionist();
  const parsed = slugSchema.safeParse(raw);
  if (!parsed.success) {
    return isReservedSlug(raw.trim().toLowerCase()) ? "reserved" : "invalid";
  }
  const slug = parsed.data;
  if (slug === nutritionist.slug) return "current";
  const existing = await db.query.nutritionists.findFirst({
    where: and(eq(nutritionists.slug, slug), ne(nutritionists.id, nutritionist.id)),
    columns: { id: true },
  });
  return existing ? "taken" : "ok";
}

/** Guarda perfil + links + apariencia. Todo filtrado por nutritionist.id. */
export async function saveMyPage(input: unknown): Promise<SaveResult> {
  const { nutritionist } = await requireNutritionist();

  const parsed = myPageSchema.safeParse(input);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return {
      ok: false,
      error: "Revisa los campos marcados",
      fieldErrors: flat.fieldErrors as Record<string, string[] | undefined>,
    };
  }
  const data = parsed.data;

  if (data.slug !== nutritionist.slug) {
    const taken = await db.query.nutritionists.findFirst({
      where: and(eq(nutritionists.slug, data.slug), ne(nutritionists.id, nutritionist.id)),
      columns: { id: true },
    });
    if (taken) {
      return { ok: false, error: "Ese link ya está en uso", fieldErrors: { slug: ["Ya está en uso"] } };
    }
  }

  const links: NutritionistLink[] = data.links.map((l) => ({
    id: l.id,
    label: l.label,
    url: l.url,
    icon: l.icon,
    visible: l.visible,
  }));
  const theme: NutritionistTheme = { ...data.theme };

  try {
    await db
      .update(nutritionists)
      .set({
        displayName: data.displayName,
        slug: data.slug,
        bio: data.bio,
        cedula: data.cedula,
        phoneWa: data.phoneWa,
        avatarUrl: data.avatarUrl,
        links,
        theme,
        updatedAt: new Date(),
      })
      .where(eq(nutritionists.id, nutritionist.id));
  } catch (err) {
    // Carrera en el unique de slug (23505) u otro error de DB.
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate|23505/i.test(msg)) {
      return { ok: false, error: "Ese link ya está en uso", fieldErrors: { slug: ["Ya está en uso"] } };
    }
    console.error("[mi-pagina] saveMyPage", err);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }

  updateTag(cacheTagFor(nutritionist.slug));
  if (data.slug !== nutritionist.slug) updateTag(cacheTagFor(data.slug));

  return { ok: true, slug: data.slug };
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Sube la foto de perfil a R2 (server-side, sin CORS) y la guarda en el perfil.
 * El cliente ya la redimensionó a 512px; aquí solo validamos tipo y tamaño.
 */
export async function uploadAvatar(formData: FormData): Promise<UploadResult> {
  const { nutritionist } = await requireNutritionist();

  if (!isStorageConfigured()) {
    return { ok: false, error: "Configura R2 para subir fotos (ver .env.example)." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No llegó ningún archivo" };
  if (!isAvatarType(file.type)) return { ok: false, error: "Usa JPG, PNG o WebP" };
  if (file.size > AVATAR_MAX_BYTES) return { ok: false, error: "La imagen pesa más de 2 MB" };

  try {
    const key = avatarKey(nutritionist.id, file.type);
    const body = new Uint8Array(await file.arrayBuffer());
    const { publicUrl } = await putObject({ key, body, contentType: file.type });

    await db
      .update(nutritionists)
      .set({ avatarUrl: publicUrl, updatedAt: new Date() })
      .where(eq(nutritionists.id, nutritionist.id));

    updateTag(cacheTagFor(nutritionist.slug));
    return { ok: true, url: publicUrl };
  } catch (err) {
    if (err instanceof StorageNotConfiguredError) return { ok: false, error: err.message };
    console.error("[mi-pagina] uploadAvatar", err);
    return { ok: false, error: "No se pudo subir la foto. Intenta de nuevo." };
  }
}
