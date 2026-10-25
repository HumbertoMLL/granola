import { EmailApiError, sendEmail, type SendEmailInput } from "@granola/email";
import { NonRetriableError } from "inngest";
import type { AppointmentContext } from "./appointment";

export function appointmentEmailFields(ctx: AppointmentContext) {
  return {
    patientName: ctx.patient.name,
    nutritionistName: ctx.nutritionist.displayName,
    serviceName: ctx.service.name,
    startsAt: new Date(ctx.appointment.startsAt),
    timeZone: ctx.appointment.patientTimezone ?? ctx.nutritionist.timezone,
    modality: ctx.appointment.modality,
    meetUrl: ctx.appointment.meetUrl,
    location: ctx.service.location,
  };
}

/** Reintentos a cargo de Inngest; no persistimos correos en F1 (ADR 0010). */
export async function sendJobEmail(input: SendEmailInput) {
  try {
    return await sendEmail(input);
  } catch (error) {
    if (error instanceof EmailApiError && !error.retriable) {
      throw new NonRetriableError(error.message, { cause: error });
    }
    throw error;
  }
}
