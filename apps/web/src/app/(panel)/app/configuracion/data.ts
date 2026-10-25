import type { appointments, nutritionists, patients, services } from "@granola/db/schema";
import { deleteAccountSchema } from "@/components/configuracion/schemas";

type Nutritionist = typeof nutritionists.$inferSelect;
type Service = typeof services.$inferSelect;
type Patient = typeof patients.$inferSelect;
type Appointment = typeof appointments.$inferSelect;

/** Lista explícita: no exportar credenciales OAuth ni tokens de acceso a citas. */
export function buildAccountExport(input: {
  nutritionist: Nutritionist;
  email: string;
  services: Service[];
  patients: Patient[];
  appointments: Appointment[];
}, exportedAt: Date) {
  const n = input.nutritionist;
  const owned = <T extends { nutritionistId: string }>(rows: T[]) => rows.filter((r) => r.nutritionistId === n.id);
  return {
    version: 1,
    exportedAt: exportedAt.toISOString(),
    nutritionist: {
      id: n.id, displayName: n.displayName, email: input.email, slug: n.slug,
      bio: n.bio, avatarUrl: n.avatarUrl, cedula: n.cedula, phoneWa: n.phoneWa,
      timezone: n.timezone, theme: n.theme, links: n.links, plan: n.plan,
      bufferMin: n.bufferMin, minNoticeMin: n.minNoticeMin, slotStepMin: n.slotStepMin,
      onboardingStep: n.onboardingStep, createdAt: n.createdAt,
    },
    services: owned(input.services),
    patients: owned(input.patients),
    appointments: owned(input.appointments).map((a) => ({
      id: a.id, nutritionistId: a.nutritionistId, patientId: a.patientId, serviceId: a.serviceId,
      startsAt: a.startsAt, endsAt: a.endsAt, status: a.status, modality: a.modality,
      meetUrl: a.meetUrl, patientTimezone: a.patientTimezone, notes: a.notes,
      cancelledAt: a.cancelledAt, cancelReason: a.cancelReason, createdAt: a.createdAt,
    })),
  };
}

/** Valida antes de construir las dos operaciones del batch atómico. */
export function accountDeletionScope(input: unknown, owner: { nutritionistId: string; userId: string }) {
  deleteAccountSchema.parse(input);
  return [
    { entity: "appointments", nutritionistId: owner.nutritionistId },
    { entity: "users", userId: owner.userId },
  ] as const;
}
