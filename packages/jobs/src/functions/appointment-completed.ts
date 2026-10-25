import { buildPideResena } from "@granola/whatsapp";
import { inngest } from "../client";
import { firstName, loadAppointment } from "../lib/appointment";
import { sendToPatient } from "../lib/send";

/** appointment/completed → pide_resena al paciente. */
export const onAppointmentCompleted = inngest.createFunction(
  { id: "appointment-completed", name: "Cita terminada: pedir reseña", retries: 4 },
  { event: "appointment/completed" },
  async ({ event, step }) => {
    const { appointmentId } = event.data;
    const ctx = await step.run("cargar-cita", () => loadAppointment(appointmentId, event.data.nutritionistId));
    if (!ctx) return { skipped: "cita no existe" };
    if (ctx.appointment.status !== "completed") return { skipped: `status ${ctx.appointment.status}` };

    return step.run("wa-pide-resena", () =>
      sendToPatient(
        ctx,
        buildPideResena({
          patientName: firstName(ctx.patient.name),
          nutritionistName: ctx.nutritionist.displayName,
          cancelToken: ctx.appointment.cancelToken,
        }),
      ),
    );
  },
);
