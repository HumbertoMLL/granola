"use server";

import { updateTag } from "next/cache";

import { verifyUserPassword } from "@granola/auth/password";

import {
  ACCOUNT_DELETION_GRACE_DAYS,
  CANCEL_REASON_ACCOUNT_CLOSED,
  requestAccountDeletionSchema,
  type AccountDeletionResult,
} from "@/components/configuracion/account-deletion-schema";
import { getClientIp } from "@/lib/booking";
import {
  and,
  appointments,
  auditLog,
  db,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  nutritionists,
  sessions,
  users,
} from "@/lib/db";
import { sendEvent } from "@/lib/inngest-client";
import { cacheTagFor } from "@/lib/public-profile";
import { requireNutritionist } from "@/lib/session";

const DAY_MS = 86_400_000;

/**
 * Borrado lógico con 30 días de gracia (ADR 0015). Nunca borra filas:
 * marca `deleted_at` y `deletion_scheduled_for`, cancela las citas futuras
 * (WhatsApp avisa a cada paciente), revoca todas las sesiones y audita.
 * El purge (anonimización) lo hace el job `account/purge` al vencer la gracia.
 */
export async function requestAccountDeletion(input: unknown): Promise<AccountDeletionResult> {
  const { user, nutritionist } = await requireNutritionist();
  const parsed = requestAccountDeletionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  if (!(await verifyUserPassword(user.id, parsed.data.password))) {
    return { ok: false, error: "La contraseña no es correcta" };
  }

  const now = new Date();
  const scheduledFor = new Date(now.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS);
  const future = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.nutritionistId, nutritionist.id),
        inArray(appointments.status, ["confirmed", "pending_payment"]),
        gt(appointments.startsAt, now),
      ),
    );
  const futureIds = future.map((a) => a.id);

  // Una transacción (db.batch en neon-http): marca, cancela citas, revoca sesiones y audita.
  const markNutritionist = db
    .update(nutritionists)
    .set({ deletedAt: now, deletionScheduledFor: scheduledFor, updatedAt: now })
    .where(and(eq(nutritionists.id, nutritionist.id), isNull(nutritionists.deletedAt)));
  const markUser = db.update(users).set({ deletedAt: now, updatedAt: now }).where(eq(users.id, user.id));
  const revokeSessions = db.delete(sessions).where(eq(sessions.userId, user.id));
  const audit = db.insert(auditLog).values({
    actorId: user.id,
    action: "account.delete_requested",
    entity: "nutritionist",
    entityId: nutritionist.id,
    ip: await getClientIp(),
    meta: { scheduledFor: scheduledFor.toISOString(), cancelledAppointments: futureIds.length },
  });
  if (futureIds.length > 0) {
    await db.batch([
      markNutritionist,
      markUser,
      db
        .update(appointments)
        .set({ status: "cancelled", cancelledAt: now, cancelReason: CANCEL_REASON_ACCOUNT_CLOSED, updatedAt: now })
        .where(and(eq(appointments.nutritionistId, nutritionist.id), inArray(appointments.id, futureIds))),
      revokeSessions,
      audit,
    ]);
  } else {
    await db.batch([markNutritionist, markUser, revokeSessions, audit]);
  }

  // Después del commit: un evento por cita → onAppointmentCancelled manda `cita_cancelada`.
  for (const appointmentId of futureIds) {
    await sendEvent({
      name: "appointment/cancelled",
      data: { appointmentId, nutritionistId: nutritionist.id, by: "nutritionist" },
    });
  }

  updateTag(cacheTagFor(nutritionist.slug));
  return { ok: true, scheduledFor: scheduledFor.toISOString() };
}

/**
 * Revierte el borrado si la gracia no ha vencido. Las citas que se cancelaron
 * al pedir el borrado **no** se restauran: las pacientes ya recibieron el aviso.
 */
export async function cancelAccountDeletion(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user, nutritionist } = await requireNutritionist({ allowPendingDeletion: true });
  if (!nutritionist.deletedAt) return { ok: true };
  const now = new Date();
  if (nutritionist.purgedAt || !nutritionist.deletionScheduledFor || nutritionist.deletionScheduledFor <= now) {
    return { ok: false, error: "El periodo de 30 días ya terminó; la cuenta no se puede recuperar." };
  }

  await db.batch([
    db
      .update(nutritionists)
      .set({ deletedAt: null, deletionScheduledFor: null, updatedAt: now })
      .where(
        and(
          eq(nutritionists.id, nutritionist.id),
          isNotNull(nutritionists.deletedAt),
          isNull(nutritionists.purgedAt),
          gt(nutritionists.deletionScheduledFor, now),
        ),
      ),
    db.update(users).set({ deletedAt: null, updatedAt: now }).where(eq(users.id, user.id)),
    db.insert(auditLog).values({
      actorId: user.id,
      action: "account.delete_cancelled",
      entity: "nutritionist",
      entityId: nutritionist.id,
      ip: await getClientIp(),
      meta: { wasScheduledFor: nutritionist.deletionScheduledFor.toISOString() },
    }),
  ]);

  updateTag(cacheTagFor(nutritionist.slug));
  return { ok: true };
}
