import { z } from "zod";

/** Máximo de caracteres del texto de la reseña (UI y server action). */
export const REVIEW_TEXT_MAX = 500;

/** Mismo rango que `cancel_token` en /cita/[cancelToken]. */
export const reviewTokenSchema = z.string().min(16).max(64);

export const reviewInputSchema = z.object({
  token: reviewTokenSchema,
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas").max(5, "Elige de 1 a 5 estrellas"),
  text: z
    .string()
    .trim()
    .max(REVIEW_TEXT_MAX, `Máximo ${REVIEW_TEXT_MAX} caracteres`)
    .optional()
    .transform((v) => (v ? v : null)),
  isPublic: z.boolean(),
});

export type ReviewInput = z.input<typeof reviewInputSchema>;

export const RATING_LABEL: Record<number, string> = {
  1: "Mala",
  2: "Regular",
  3: "Buena",
  4: "Muy buena",
  5: "Excelente",
};
