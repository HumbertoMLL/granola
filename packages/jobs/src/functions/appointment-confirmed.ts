import { and, appointments, db, eq } from "@granola/db";
import { buildCitaConfirmada, buildNuevaCitaNutri, buildRecordatorio24h, buildRecordatorio2h } from "@granola/whatsapp";
import { inngest } from "../client";
import { firstName, loadAppointment, paymentLabel, type AppointmentContext } from "../lib/appointment";
import { sendToNutritionist, sendToPatient } from "../lib/send";

const H = 3_600_000;

/** Decisiones calculadas una sola vez (memoizadas por Inngest) para que las ramas sean estables entre replays. */
type Plan = { remind24hAt: string | null; remind2hAt: string | null; completeAt: string };

function planFor(ctx: AppointmentContext, now = Date.now()): Plan {
  const startsAt = new Date(ctx.appointment.startsAt).getTime();
  const endsAt = new Date(ctx.appointment.endsAt).getTime();
  const t24 = startsAt - 24 * H;
  const t2 = startsAt - 2 * H;
  return {
    // Si ya pasó la hora del recordatorio (cita agendada con poca antelación) no se manda.
    remind24hAt: t24 > now ? new Date(t24).toISOString() : null,
    remind2hAt: t2 > now ? new Date(t2).toISOString() : null,
    completeAt: new Date(endsAt + 2 * H).toISOString(),
  };
}

/**
 * appointment/confirmed → cita_confirmada + nueva_cita_nutri, recordatorios 24h y 2h,
 * y al terminar (+2h) marca completed y emite appointment/completed.
 * Se cancela solo si la cita se cancela o reagenda (cancelOn por appointmentId).
 */
export const onAppointmentConfirmed = inngest.createFunction(
  {
    id: "appointment-confirmed",
    name: "Cita confirmada: WhatsApp + recordatorios",
    retries: 4,
    cancelOn: [
      { event: "appointment/cancelled", match: "data.appointmentId" },
      { event: "appointment/rescheduled", match: "data.appointmentId" },
    ],
  },
  { event: "appointment/confirmed" },
  async ({ event, step }) => {
    const { appointmentId, isReschedule } = event.data;

    const ctx = await step.run("cargar-cita", () => loadAppointment(appointmentId));
    if (!ctx) return { skipped: "cita no existe" };
    if (ctx.appointment.status !== "confirmed") return { skipped: `status ${ctx.appointment.status}` };

    // Hora al paciente en SU zona si la guardamos al agendar; al nutri siempre en la suya.
    const patientTimeZone = ctx.appointment.patientTimezone ?? ctx.nutritionist.timezone;

    const common = {
      patientName: firstName(ctx.patient.name),
      nutritionistName: ctx.nutritionist.displayName,
      startsAt: new Date(ctx.appointment.startsAt),
      timeZone: patientTimeZone,
      modality: ctx.appointment.modality,
      meetUrl: ctx.appointment.meetUrl,
      location: ctx.service.location,
      cancelToken: ctx.appointment.cancelToken,
    };

    if (!isReschedule) {
      await step.run("wa-cita-confirmada", () => sendToPatient(ctx, buildCitaConfirmada(common)));
      await step.run("wa-nueva-cita-nutri", () =>
        sendToNutritionist(
          ctx,
          buildNuevaCitaNutri({
            appointmentId,
            patientName: ctx.patient.name,
            serviceName: ctx.service.name,
            startsAt: common.startsAt,
            timeZone: ctx.nutritionist.timezone,
            modality: ctx.appointment.modality,
            paymentLabel: paymentLabel(ctx),
          }),
        ),
      );
    }

    const plan = await step.run("plan", () => planFor(ctx));

    // ── Recordatorio 24h ──
    if (plan.remind24hAt) {
      await step.sleepUntil("esperar-24h", plan.remind24hAt);
      const fresh = await step.run("recargar-24h", () => loadAppointment(appointmentId));
      if (fresh && fresh.appointment.status === "confirmed" && !fresh.appointment.reminder24hSentAt) {
        await step.run("wa-recordatorio-24h", async () => {
          const out = await sendToPatient(fresh, buildRecordatorio24h({ ...common, ...freshFields(fresh), appointmentId }));
          if (out.sent) await db.update(appointments).set({ reminder24hSentAt: new Date(), updatedAt: new Date() }).where(eq(appointments.id, appointmentId));
          return out;
        });
      }
    }

    // ── Recordatorio 2h ──
    if (plan.remind2hAt) {
      await step.sleepUntil("esperar-2h", plan.remind2hAt);
      const fresh = await step.run("recargar-2h", () => loadAppointment(appointmentId));
      if (fresh && fresh.appointment.status === "confirmed" && !fresh.appointment.reminder2hSentAt) {
        await step.run("wa-recordatorio-2h", async () => {
          const out = await sendToPatient(fresh, buildRecordatorio2h({ ...common, ...freshFields(fresh) }));
          if (out.sent) await db.update(appointments).set({ reminder2hSentAt: new Date(), updatedAt: new Date() }).where(eq(appointments.id, appointmentId));
          return out;
        });
      }
    }

    // ── Cierre: 2h después de terminar ──
    await step.sleepUntil("esperar-fin", plan.completeAt);
    const completed = await step.run("marcar-completed", async () => {
      const rows = await db
        .update(appointments)
        .set({ status: "completed", updatedAt: new Date() })
        .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "confirmed")))
        .returning({ id: appointments.id });
      // Solo si seguía confirmed; si la nutri la marcó no_show/cancelled, no se toca.
      return rows.length > 0;
    });

    if (completed) {
      await step.sendEvent("emitir-completed", {
        name: "appointment/completed",
        data: { appointmentId, nutritionistId: ctx.appointment.nutritionistId },
      });
    }

    return { done: true, completed };
  },
);

/** Campos que pueden cambiar entre la confirmación y el recordatorio (link Meet, dirección). */
function freshFields(fresh: AppointmentContext) {
  return {
    startsAt: new Date(fresh.appointment.startsAt),
    meetUrl: fresh.appointment.meetUrl,
    location: fresh.service.location,
    modality: fresh.appointment.modality,
  };
}
