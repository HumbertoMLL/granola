"use server";

import { updateTag } from "next/cache";

import { ANON_ACTION_LIMIT, checkRateLimit, RATE_LIMIT_MESSAGE } from "@granola/api/rate-limit";

import { reviewInputSchema, type ReviewInput } from "@/components/reviews/review-schema";
import { getClientIp } from "@/lib/booking";
import { appointments, db, eq, reviews } from "@/lib/db";
import { cacheTagFor } from "@/lib/public-profile";

export type SubmitReviewResult =
  | { ok: true }
  | { ok: false; error: string; alreadyReviewed?: boolean };

/**
 * Reseña verificada desde el link de `pide_resena` (sin login: el `cancel_token`
 * es la credencial). Solo citas `completed` y una reseña por cita.
 */
export async function submitReview(input: ReviewInput): Promise<SubmitReviewResult> {
  // Freno anti-abuso por IP (store por entorno; ver @granola/api/rate-limit).
  const ip = await getClientIp();
  if (!(await checkRateLimit(`resena:submit:${ip}`, ANON_ACTION_LIMIT)).ok) return { ok: false, error: RATE_LIMIT_MESSAGE };

  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revisa tu reseña" };
  const { token, rating, text, isPublic } = parsed.data;

  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.cancelToken, token),
    columns: { id: true, status: true, nutritionistId: true, patientId: true },
    with: {
      nutritionist: { columns: { slug: true } },
      reviews: { columns: { id: true }, limit: 1 },
    },
  });
  if (!appt) return { ok: false, error: "No encontramos esta cita" };
  if (appt.reviews.length > 0) return { ok: false, error: "Ya dejaste tu reseña", alreadyReviewed: true };
  if (appt.status !== "completed") return { ok: false, error: "Podrás dejar tu reseña cuando termine tu cita" };

  // appointment_id es UNIQUE: si dos envíos llegan a la vez, el segundo no inserta.
  const inserted = await db
    .insert(reviews)
    .values({
      nutritionistId: appt.nutritionistId,
      patientId: appt.patientId,
      appointmentId: appt.id,
      rating,
      text,
      isPublic,
      verified: true,
    })
    .onConflictDoNothing({ target: reviews.appointmentId })
    .returning({ id: reviews.id });
  if (inserted.length === 0) return { ok: false, error: "Ya dejaste tu reseña", alreadyReviewed: true };

  // La página pública (cacheada por slug) muestra reseñas y promedio.
  updateTag(cacheTagFor(appt.nutritionist.slug));
  return { ok: true };
}
