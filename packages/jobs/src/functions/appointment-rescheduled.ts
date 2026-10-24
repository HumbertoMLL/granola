import { buildCitaReagendada } from "@granola/whatsapp";
import { inngest } from "../client";
import { firstName, loadAppointment } from "../lib/appointment";
import { sendToPatient } from "../lib/send";

/**
 * appointment/rescheduled → cita_reagendada al paciente y re-emite
 * appointment/confirmed con isReschedule=true para rearmar los recordatorios
 * (el run viejo de onAppointmentConfirmed ya se canceló por cancelOn).
 */
export const onAppointmentRescheduled = inngest.createFunction(
  { id: "appointment-rescheduled", name: "Cita reagendada: WhatsApp + rearmar recordatorios", retries: 4 },
  { event: "appointment/rescheduled" },
  async ({ event, step }) => {
    const { appointmentId, nutritionistId, previousStartsAt } = event.data;
    const ctx = await step.run("cargar-cita", () => loadAppointment(appointmentId));
    if (!ctx) return { skipped: "cita no existe" };
    if (ctx.appointment.status !== "confirmed") return { skipped: `status ${ctx.appointment.status}` };

    await step.run("wa-cita-reagendada", () =>
      sendToPatient(
        ctx,
        buildCitaReagendada({
          patientName: firstName(ctx.patient.name),
          nutritionistName: ctx.nutritionist.displayName,
          previousStartsAt: new Date(previousStartsAt),
          startsAt: new Date(ctx.appointment.startsAt),
          timeZone: ctx.appointment.patientTimezone ?? ctx.nutritionist.timezone,
          modality: ctx.appointment.modality,
          meetUrl: ctx.appointment.meetUrl,
          location: ctx.service.location,
          cancelToken: ctx.appointment.cancelToken,
        }),
      ),
    );

    await step.sendEvent("rearmar-recordatorios", {
      name: "appointment/confirmed",
      data: { appointmentId, nutritionistId, isReschedule: true },
    });

    return { rearmed: true };
  },
);
