import { citaCancelada } from "@granola/email";
import { appointmentEmailFields, sendJobEmail } from "../lib/email";
import { buildCitaCancelada } from "@granola/whatsapp";
import { inngest } from "../client";
import { firstName, loadAppointment } from "../lib/appointment";
import { sendToPatient } from "../lib/send";

/** appointment/cancelled → cita_cancelada al paciente. Los recordatorios los cancela el cancelOn de onAppointmentConfirmed. */
export const onAppointmentCancelled = inngest.createFunction(
  { id: "appointment-cancelled", name: "Cita cancelada: WhatsApp + correo", retries: 4 },
  { event: "appointment/cancelled" },
  async ({ event, step }) => {
    const { appointmentId, by } = event.data;
    const ctx = await step.run("cargar-cita", () => loadAppointment(appointmentId, event.data.nutritionistId));
    if (!ctx) return { skipped: "cita no existe" };
    if (ctx.appointment.status !== "cancelled") return { skipped: `status ${ctx.appointment.status}` };

    const out = await step.run("wa-cita-cancelada", () =>
      sendToPatient(
        ctx,
        buildCitaCancelada({
          patientName: firstName(ctx.patient.name),
          nutritionistName: ctx.nutritionist.displayName,
          startsAt: new Date(ctx.appointment.startsAt),
          timeZone: ctx.appointment.patientTimezone ?? ctx.nutritionist.timezone,
          by,
          nutritionistSlug: ctx.nutritionist.slug,
        }),
      ),
    );
    const patientEmail = ctx.patient.email;
    if (patientEmail) {
      const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
      await step.run("email-cita-cancelada-paciente", () => sendJobEmail({
        to: patientEmail,
        ...citaCancelada({ ...appointmentEmailFields(ctx), meetUrl: null,
          manageUrl: new URL(`/${encodeURIComponent(ctx.nutritionist.slug)}/agendar`, origin).toString() }),
        tags: [{ name: "template", value: "cita_cancelada" }],
        idempotencyKey: `cancelled-${event.id ?? appointmentId}-patient`,
      }));
    }
    return out;
  },
);
