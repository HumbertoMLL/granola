import { z } from "zod";

/** Días entre pedir el borrado y el purge (ADR 0015). */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

/** `appointments.cancel_reason` de las citas futuras canceladas al pedir el borrado. */
export const CANCEL_REASON_ACCOUNT_CLOSED = "La nutrióloga cerró su cuenta en Granola";

export const requestAccountDeletionSchema = z.object({
  password: z.string().min(1, "Escribe tu contraseña").max(128),
  confirmation: z.literal("ELIMINAR", { error: "Escribe ELIMINAR para confirmar" }),
});

export type RequestAccountDeletionInput = z.input<typeof requestAccountDeletionSchema>;

export type AccountDeletionResult = { ok: true; scheduledFor: string } | { ok: false; error: string };
