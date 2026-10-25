import "server-only";

import {
  appointments,
  availabilityOverrides,
  availabilityRules,
  db,
  eq,
  nutritionists,
  patients,
  payments,
  services,
} from "@/lib/db";

export const ACCOUNT_EXPORT_VERSION = 1;

/**
 * Todo lo que la nutrióloga tiene en Granola, filtrado por `nutritionist_id`
 * (regla dura #1). Columnas explícitas: nunca salen tokens OAuth, requisitos de
 * Stripe ni `cancel_token` de las citas (son llaves de acceso, no datos).
 *
 * TODO(F2): cuando `measurements` y `clinical_notes` (PR #2) estén en main,
 * agregarlas aquí con el mismo filtro.
 */
export async function collectAccountExport(nutritionistId: string, email: string, exportedAt = new Date()) {
  const [profile, ownedServices, rules, overrides, ownedPatients, ownedAppointments, ownedPayments] =
    await Promise.all([
      db
        .select({
          id: nutritionists.id,
          displayName: nutritionists.displayName,
          slug: nutritionists.slug,
          bio: nutritionists.bio,
          avatarUrl: nutritionists.avatarUrl,
          cedula: nutritionists.cedula,
          phoneWa: nutritionists.phoneWa,
          timezone: nutritionists.timezone,
          theme: nutritionists.theme,
          links: nutritionists.links,
          plan: nutritionists.plan,
          bufferMin: nutritionists.bufferMin,
          minNoticeMin: nutritionists.minNoticeMin,
          slotStepMin: nutritionists.slotStepMin,
          createdAt: nutritionists.createdAt,
        })
        .from(nutritionists)
        .where(eq(nutritionists.id, nutritionistId)),
      db.select().from(services).where(eq(services.nutritionistId, nutritionistId)),
      db
        .select({
          weekday: availabilityRules.weekday,
          startTime: availabilityRules.startTime,
          endTime: availabilityRules.endTime,
        })
        .from(availabilityRules)
        .where(eq(availabilityRules.nutritionistId, nutritionistId)),
      db
        .select({
          date: availabilityOverrides.date,
          startTime: availabilityOverrides.startTime,
          endTime: availabilityOverrides.endTime,
          isBlocked: availabilityOverrides.isBlocked,
        })
        .from(availabilityOverrides)
        .where(eq(availabilityOverrides.nutritionistId, nutritionistId)),
      db.select().from(patients).where(eq(patients.nutritionistId, nutritionistId)),
      db
        .select({
          id: appointments.id,
          patientId: appointments.patientId,
          serviceId: appointments.serviceId,
          startsAt: appointments.startsAt,
          endsAt: appointments.endsAt,
          status: appointments.status,
          modality: appointments.modality,
          meetUrl: appointments.meetUrl,
          patientTimezone: appointments.patientTimezone,
          notes: appointments.notes,
          cancelledAt: appointments.cancelledAt,
          cancelReason: appointments.cancelReason,
          createdAt: appointments.createdAt,
        })
        .from(appointments)
        .where(eq(appointments.nutritionistId, nutritionistId)),
      db
        .select({
          id: payments.id,
          appointmentId: payments.appointmentId,
          provider: payments.provider,
          providerRef: payments.providerRef,
          amountCents: payments.amountCents,
          currency: payments.currency,
          status: payments.status,
          method: payments.method,
          paidAt: payments.paidAt,
          failureReason: payments.failureReason,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .innerJoin(appointments, eq(appointments.id, payments.appointmentId))
        .where(eq(appointments.nutritionistId, nutritionistId)),
    ]);

  return {
    version: ACCOUNT_EXPORT_VERSION,
    exportedAt: exportedAt.toISOString(),
    nutritionist: profile[0] ? { ...profile[0], email } : null,
    services: ownedServices,
    availability: { rules, overrides },
    patients: ownedPatients,
    appointments: ownedAppointments,
    payments: ownedPayments,
  };
}

export type AccountExport = Awaited<ReturnType<typeof collectAccountExport>>;
