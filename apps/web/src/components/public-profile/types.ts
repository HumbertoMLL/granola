// Tipos y helpers PUROS de la página pública (sin IO). Seguros en cliente:
// los usa tanto el loader (`@/lib/public-profile`) como el editor (preview en vivo).

import type { LinkIcon } from "@granola/db/schema";
import { isLinkIcon, type ResolvedTheme } from "./theme";

export type PublicLink = {
  id: string;
  label: string;
  url: string;
  icon: LinkIcon;
};

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  currency: string;
  modality: "online" | "presencial" | "ambas";
  packageSessions: number | null;
};

export type PublicReview = {
  id: string;
  rating: number;
  text: string | null;
  /** Solo nombre de pila del paciente (p. ej. "Ana"). */
  authorName: string;
  createdAt: string; // ISO
};

/**
 * Lo que la página pública necesita y NADA más. Nunca email, tokens de Google,
 * ids de Stripe/MP, plan ni onboarding.
 */
export type PublicProfile = {
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  cedula: string | null;
  /** Solo si theme.showWhatsApp. Dígitos E.164 sin "+" para wa.me. */
  phoneWa: string | null;
  theme: ResolvedTheme;
  links: PublicLink[];
  services: PublicService[];
  reviews: PublicReview[];
  reviewStats: { count: number; average: number } | null;
};

export const SLUG_MIN = 3;
export const SLUG_MAX = 30;
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const BIO_MAX = 300;

/** Minúsculas, sin acentos, solo a-z0-9 y guiones. No valida longitud. */
export function normalizeSlug(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX);
}

/** Convierte el jsonb `links` crudo en links públicos (visibles, con url http(s)). */
export function toPublicLinks(raw: unknown): PublicLink[] {
  if (!Array.isArray(raw)) return [];
  const out: PublicLink[] = [];
  raw.forEach((l, i) => {
    if (!l || typeof l !== "object") return;
    const link = l as {
      id?: unknown;
      label?: unknown;
      url?: unknown;
      icon?: unknown;
      visible?: unknown;
    };
    if (link.visible === false) return;
    if (typeof link.label !== "string" || typeof link.url !== "string") return;
    if (!/^https?:\/\//i.test(link.url)) return;
    out.push({
      id: typeof link.id === "string" ? link.id : `link-${i}`,
      label: link.label,
      url: link.url,
      icon: isLinkIcon(link.icon) ? link.icon : "otro",
    });
  });
  return out;
}

/** Deja solo dígitos para wa.me (acepta "+52 1 55..." o "5215512345678"). */
export function waDigits(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}
