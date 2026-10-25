import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { and, count, db, desc, eq, isNull, nutritionists, reviews, services, sql } from "@/lib/db";
import type { NutritionistTheme } from "@granola/db/schema";
import { resolveTheme } from "@/components/public-profile/theme";
import {
  SLUG_RE,
  toPublicLinks,
  waDigits,
  type PublicProfile,
} from "@/components/public-profile/types";

export type {
  PublicLink,
  PublicProfile,
  PublicReview,
  PublicService,
} from "@/components/public-profile/types";
export { normalizeSlug, SLUG_MAX, SLUG_MIN, SLUG_RE } from "@/components/public-profile/types";

/**
 * Slugs que nunca puede tomar una nutri: chocan con rutas del sistema
 * (`/app`, `/login`, ...) o las reservamos para el futuro (`/p`, `/precios`).
 */
export const RESERVED_SLUGS = [
  "app",
  "login",
  "registro",
  "api",
  "privacidad",
  "cita",
  "resena",
  "pago",
  "p",
  "precios",
  // extras defensivos
  "admin",
  "granola",
  "www",
  "assets",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "opengraph-image",
  "terminos",
  "ayuda",
  "cuenta-eliminada",
  "blog",
] as const;

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase());
}

export function cacheTagFor(slug: string): string {
  return `profile:${slug}`;
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? "Paciente";
}

/**
 * Carga la página pública de una nutri. Cacheado por slug: el editor invalida con
 * `updateTag(cacheTagFor(slug))` al guardar. Devuelve null si el slug no existe
 * o está reservado. Solo expone campos públicos (ver PublicProfile).
 */
export async function getPublicProfile(slugInput: string): Promise<PublicProfile | null> {
  "use cache";
  const slug = slugInput.toLowerCase();
  cacheTag(cacheTagFor(slug));
  cacheLife("days");

  if (isReservedSlug(slug) || !SLUG_RE.test(slug)) return null;

  const n = await db.query.nutritionists.findFirst({
    // Cuenta en gracia de borrado (ADR 0015): 404, el slug sigue reservado.
    where: and(eq(nutritionists.slug, slug), isNull(nutritionists.deletedAt)),
    columns: {
      id: true,
      slug: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      cedula: true,
      phoneWa: true,
      theme: true,
      links: true,
    },
  });
  if (!n) return null;

  const theme = resolveTheme(n.theme as NutritionistTheme);
  const publicReviewsWhere = and(
    eq(reviews.nutritionistId, n.id),
    eq(reviews.isPublic, true),
    eq(reviews.verified, true),
  );

  const [svcRows, reviewRows, statsRows] = await Promise.all([
    db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
        durationMin: services.durationMin,
        priceCents: services.priceCents,
        currency: services.currency,
        modality: services.modality,
        packageSessions: services.packageSessions,
      })
      .from(services)
      .where(and(eq(services.nutritionistId, n.id), eq(services.isActive, true)))
      .orderBy(services.sortOrder, services.createdAt),
    theme.showReviews
      ? db.query.reviews.findMany({
          where: publicReviewsWhere,
          orderBy: [desc(reviews.createdAt)],
          limit: 3,
          columns: { id: true, rating: true, text: true, createdAt: true },
          with: { patient: { columns: { name: true } } },
        })
      : Promise.resolve([]),
    theme.showReviews
      ? db
          .select({
            count: count(),
            average: sql<number>`coalesce(avg(${reviews.rating}), 0)::float`,
          })
          .from(reviews)
          .where(publicReviewsWhere)
      : Promise.resolve([]),
  ]);

  const stats = statsRows[0];
  const reviewStats =
    stats && Number(stats.count) > 0
      ? { count: Number(stats.count), average: Math.round(Number(stats.average) * 10) / 10 }
      : null;

  return {
    slug: n.slug,
    displayName: n.displayName,
    bio: n.bio,
    avatarUrl: n.avatarUrl,
    cedula: n.cedula,
    phoneWa: theme.showWhatsApp ? waDigits(n.phoneWa) : null,
    theme,
    links: toPublicLinks(n.links),
    services: svcRows,
    reviews: reviewRows.map((r) => ({
      id: r.id,
      rating: r.rating,
      text: r.text,
      authorName: firstName(r.patient.name),
      createdAt: r.createdAt.toISOString(),
    })),
    reviewStats,
  };
}
