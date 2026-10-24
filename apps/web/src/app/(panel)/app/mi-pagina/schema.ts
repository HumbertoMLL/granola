// Schemas zod del editor de Mi página. Archivo aparte porque un módulo "use server"
// solo puede exportar funciones async.
import { z } from "zod";

import { isReservedSlug } from "@/lib/public-profile";
import { BUTTON_STYLES, LINK_ICONS, THEME_PRESETS } from "@/components/public-profile/theme";
import { BIO_MAX, SLUG_MAX, SLUG_MIN, SLUG_RE } from "@/components/public-profile/types";

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SLUG_MIN, `Mínimo ${SLUG_MIN} caracteres`)
  .max(SLUG_MAX, `Máximo ${SLUG_MAX} caracteres`)
  .regex(SLUG_RE, "Solo letras minúsculas, números y guiones")
  .refine((s) => !isReservedSlug(s), "Ese link está reservado");

const optionalText = (max: number, msg?: string) =>
  z
    .string()
    .trim()
    .max(max, msg ?? `Máximo ${max} caracteres`)
    .transform((s) => (s.length ? s : null));

const linkSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1, "Ponle un título").max(40, "Máximo 40 caracteres"),
  url: z
    .string()
    .trim()
    .max(500)
    .refine((u) => /^https?:\/\/\S+\.\S+/i.test(u), "Debe empezar con https://"),
  icon: z.enum(LINK_ICONS),
  visible: z.boolean(),
});

const themeSchema = z.object({
  preset: z.enum(THEME_PRESETS),
  buttonStyle: z.enum(BUTTON_STYLES),
  showWhatsApp: z.boolean(),
  showReviews: z.boolean(),
});

export const myPageSchema = z.object({
  displayName: z.string().trim().min(2, "Mínimo 2 caracteres").max(60, "Máximo 60 caracteres"),
  slug: slugSchema,
  bio: optionalText(BIO_MAX),
  cedula: z
    .string()
    .trim()
    .max(20, "Máximo 20 caracteres")
    .regex(/^[0-9A-Za-z-]*$/, "Solo números y letras")
    .transform((s) => (s.length ? s : null)),
  phoneWa: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s()-]/g, ""))
    .refine((s) => s === "" || /^\+[1-9]\d{7,14}$/.test(s), "Formato E.164, p. ej. +5215512345678")
    .transform((s) => (s.length ? s : null)),
  avatarUrl: z.url().max(1000).nullable(),
  links: z.array(linkSchema).max(20, "Máximo 20 links"),
  theme: themeSchema,
});

export type MyPageInput = z.input<typeof myPageSchema>;

export type SaveResult =
  | { ok: true; slug: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };
