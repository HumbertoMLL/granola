import { documentsReady } from "@granola/db/documents-ready";
import { deleteClinicalFiles } from "./r2";
import {
  accounts,
  and,
  auditLog,
  db,
  eq,
  isNotNull,
  isNull,
  lt,
  nutritionists,
  patients,
  services,
  sessions,
  users,
  verifications,
  waMessages,
  documents,
  reports,
} from "@granola/db";

/**
 * Purge de cuentas vencidas (ADR 0015). Se ejecuta cuando terminan los 30 días
 * de gracia (`deletion_scheduled_for < now`). **Anonimiza, no borra en cascada**:
 * citas, pagos y (cuando existan) mediciones y notas clínicas se conservan
 * ligados a la nutri anonimizada por retención legal (NOM-004: 5 años; SAT).
 *
 * TODO(F5): columna `purge_after` (≈ deleted_at + 5 años) y un segundo job que
 * borre definitivamente lo retenido cuando venza.
 */

export const PURGE_ACTOR = "system:account-purge";
export const ANONYMOUS_PATIENT_NAME = "Paciente";
export const DELETED_ACCOUNT_NAME = "Cuenta eliminada";

export function anonymizedEmail(userId: string): string {
  return `deleted+${userId}@granola.invalid`;
}

/** Ids de cuentas en gracia vencida y aún sin purgar (usa nutritionists_deletion_due_idx). */
export async function findAccountsDueForPurge(now: Date): Promise<string[]> {
  const rows = await db
    .select({ id: nutritionists.id })
    .from(nutritionists)
    .where(
      and(
        isNotNull(nutritionists.deletedAt),
        isNull(nutritionists.purgedAt),
        lt(nutritionists.deletionScheduledFor, now),
      ),
    );
  return rows.map((r) => r.id);
}

export type PurgeResult =
  | { purged: true; nutritionistId: string; patients: number }
  | { purged: false; nutritionistId: string; reason: string };

/**
 * Anonimiza una cuenta en una sola transacción (`db.batch` en neon-http).
 * Idempotente: si ya se purgó, se canceló el borrado o la gracia no ha vencido,
 * no hace nada.
 */
export async function purgeAccount(nutritionistId: string, now: Date = new Date()): Promise<PurgeResult> {
  const n = await db.query.nutritionists.findFirst({
    where: eq(nutritionists.id, nutritionistId),
    columns: { id: true, userId: true, deletedAt: true, deletionScheduledFor: true, purgedAt: true },
  });
  if (!n) return { purged: false, nutritionistId, reason: "no existe" };
  if (n.purgedAt) return { purged: false, nutritionistId, reason: "ya purgada" };
  if (!n.deletedAt || !n.deletionScheduledFor) return { purged: false, nutritionistId, reason: "borrado cancelado" };
  if (n.deletionScheduledFor >= now) return { purged: false, nutritionistId, reason: "gracia vigente" };

  const user = await db.query.users.findFirst({ where: eq(users.id, n.userId), columns: { email: true } });
  const patientRows = await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.nutritionistId, n.id));

  const ready = await documentsReady();
  const reportRows = ready ? await db.query.reports.findMany({ where: eq(reports.nutritionistId, n.id) }) : [];
  // Un error al borrar archivos deja la cuenta pendiente para reintentar el purge.
  await deleteClinicalFiles(n.id);
  // Sin carrera con "Cancelar eliminación": cancelAccountDeletion se niega una vez
  // vencida deletion_scheduled_for, y aquí solo llegamos con la gracia vencida.
  await db.batch([
    db
      .update(nutritionists)
      .set({
        displayName: DELETED_ACCOUNT_NAME,
        // Libera el slug (queda reservado solo durante la gracia).
        slug: `eliminada-${n.id}`,
        bio: null,
        avatarUrl: null,
        phoneWa: null,
        links: [],
        theme: {},
        googleRefreshTokenEnc: null,
        // Se conservan: cedula (atribución del expediente retenido, NOM-004) y los ids
        // de Stripe/MP (conciliación de pagos para el SAT). Ver ADR 0015.
        purgedAt: now,
        updatedAt: now,
      })
      .where(and(eq(nutritionists.id, n.id), isNotNull(nutritionists.deletedAt), isNull(nutritionists.purgedAt))),
    ...(ready ? [
      db.update(documents).set({ storageKey: "purged", parsedJson: null, parseError: null }).where(eq(documents.nutritionistId, n.id)),
      ...reportRows.map((r) => db.update(reports).set({
        content: r.content.map((i) => ({ ...i, etiqueta: i.clave, comentario: "" })),
        interpretation: "", brand: { logo_url: null, color: "#4A7A2B", firma: "" }, pdfStorageKey: null,
      }).where(and(eq(reports.id, r.id), eq(reports.nutritionistId, n.id)))),
    ] : []),
    db
      .update(patients)
      .set({ name: ANONYMOUS_PATIENT_NAME, phoneWa: null, email: null, updatedAt: now })
      .where(eq(patients.nutritionistId, n.id)),
    db
      .update(users)
      .set({
        email: anonymizedEmail(n.userId),
        name: DELETED_ACCOUNT_NAME,
        image: null,
        emailVerified: false,
        updatedAt: now,
      })
      .where(eq(users.id, n.userId)),
    db.update(services).set({ isActive: false, updatedAt: now }).where(eq(services.nutritionistId, n.id)),
    db.update(waMessages).set({ payload: {}, updatedAt: now }).where(eq(waMessages.nutritionistId, n.id)),
    db.delete(sessions).where(eq(sessions.userId, n.userId)),
    db.delete(accounts).where(eq(accounts.userId, n.userId)),
    db.delete(verifications).where(eq(verifications.identifier, user?.email ?? anonymizedEmail(n.userId))),
    db.insert(auditLog).values({
      actorId: PURGE_ACTOR,
      action: "account.purged",
      entity: "nutritionist",
      entityId: n.id,
      meta: {
        userId: n.userId,
        patientsAnonymized: patientRows.length,
        deletedAt: n.deletedAt.toISOString(),
        scheduledFor: n.deletionScheduledFor.toISOString(),
      },
    }),
  ]);

  return { purged: true, nutritionistId: n.id, patients: patientRows.length };
}
