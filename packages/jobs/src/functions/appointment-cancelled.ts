import { buildCitaCancelada } from "@granola/whatsapp";
import { inngest } from "../client";
import { firstName, loadAppointment } from "../lib/appointment";
import { sendToPatient } from "../lib/send";

/** appointment/cancelled → cita_cancelada al paciente. Los recordatorios los cancela el cancelOn de onAppointmentConfirmed. */
export const onAppointmentCancelled = inngest.createFunction(
  { id: "appointment-cancelled", name: "Cita cancelada: WhatsApp", retries: 4 },
  { event: "appointment/cancelled" },
  async ({ event, step }) => {
    const { appointmentId, by } = event.data;
    const ctx = await step.run("cargar-cita", () => loadAppointment(appointmentId));
    if (!ctx) return { skipped: "cita no existe" };
    if (ctx.appointment.status !== "cancelled") return { skipped: `status ${ctx.appointment.status}` };

    const out = await step.run("wa-cita-cancelada", () =>
      sendToPatient(
        ctx,
        buildCitaCancelada({
          patientName: firstName(ctx.patient.name),
          nutritionistName: ctx.nutritionist.displayName,
          startsAt: new Date(ctx.appointment.startsAt),
          timeZone: ctx.nutritionist.timezone,
          by,
          nutritionistSlug: ctx.nutritionist.slug,
        }),
      ),
    );
    return out;
  },
);
