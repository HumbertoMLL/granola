/**
 * CONTRATO compartido entre workstreams. Quien emite (booking, pagos, panel)
 * y quien consume (funciones Inngest) usan estos nombres y payloads.
 * Cambios aquí se avisan a todos.
 */
import { z } from "zod";

export const appointmentEventData = z.object({
  appointmentId: z.string().uuid(),
  nutritionistId: z.string().uuid(),
});

export const events = {
  /**
   * Cita confirmada (pago hecho, o servicio sin prepago). Dispara WA de confirmación + recordatorios.
   * `isReschedule: true` lo emite internamente onAppointmentRescheduled para rearmar los
   * recordatorios sin volver a mandar `cita_confirmada` / `nueva_cita_nutri` (ya se mandó `cita_reagendada`).
   * Quien emite desde booking/pagos NO lo manda.
   */
  "appointment/confirmed": appointmentEventData.extend({ isReschedule: z.boolean().optional() }),
  /** Cita cancelada por paciente o nutri. Cancela recordatorios pendientes. */
  "appointment/cancelled": appointmentEventData.extend({ by: z.enum(["patient", "nutritionist", "system"]) }),
  /** Cita reagendada: cancela recordatorios viejos y programa nuevos. */
  "appointment/rescheduled": appointmentEventData.extend({ previousStartsAt: z.string().datetime() }),
  /** Cita creada esperando pago OXXO/SPEI. Expira si no se paga. */
  "appointment/pending_payment": appointmentEventData.extend({ expiresAt: z.string().datetime() }),
  /** Cita terminada (2h después de ends_at). Pide reseña. */
  "appointment/completed": appointmentEventData,
} as const;

export type GranolaEvents = {
  [K in keyof typeof events]: { data: z.infer<(typeof events)[K]> };
};

export type GranolaEventName = keyof typeof events;
