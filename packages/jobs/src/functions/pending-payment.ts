import { and, appointments, db, desc, eq, payments } from "@granola/db";
import { expirePendingPaymentsForAppointment } from "@granola/payments";
import { buildPagoPendienteOxxo } from "@granola/whatsapp";
import { inngest } from "../client";
import { firstName, loadAppointment } from "../lib/appointment";
import { sendToPatient } from "../lib/send";

/**
 * appointment/pending_payment → pago_pendiente_oxxo al paciente; espera a
 * expiresAt y, si sigue pending_payment, cancela con by:"system" (libera el slot).
 * Se cancela si llega el pago (confirmed) o si se cancela por otra vía.
 */
export const onPendingPayment = inngest.createFunction(
  {
    id: "appointment-pending-payment",
    name: "Pago pendiente: aviso + expiración",
    retries: 4,
    cancelOn: [
      { event: "appointment/confirmed", match: "data.appointmentId" },
      { event: "appointment/cancelled", match: "data.appointmentId" },
    ],
  },
  { event: "appointment/pending_payment" },
  async ({ event, step }) => {
    const { appointmentId, nutritionistId, expiresAt } = event.data;
    const ctx = await step.run("cargar-cita", () => loadAppointment(appointmentId, event.data.nutritionistId));
    if (!ctx) return { skipped: "cita no existe" };
    if (ctx.appointment.status !== "pending_payment") return { skipped: `status ${ctx.appointment.status}` };

    // Con tarjeta el paciente está en el Checkout de Stripe: no tiene sentido mandarle
    // instrucciones de pago. Solo SPEI/OXXO reciben el WhatsApp.
    const method = await step.run("metodo-de-pago", async () => {
      const [row] = await db
        .select({ method: payments.method })
        .from(payments)
        .where(and(eq(payments.appointmentId, appointmentId), eq(payments.status, "pending")))
        .orderBy(desc(payments.createdAt))
        .limit(1);
      return row?.method ?? null;
    });

    if (method !== "card") await step.run("wa-pago-pendiente", () =>
      sendToPatient(
        ctx,
        buildPagoPendienteOxxo({
          patientName: firstName(ctx.patient.name),
          nutritionistName: ctx.nutritionist.displayName,
          startsAt: new Date(ctx.appointment.startsAt),
          timeZone: ctx.appointment.patientTimezone ?? ctx.nutritionist.timezone,
          amountCents: ctx.service.priceCents,
          currency: ctx.service.currency,
          expiresAt: new Date(expiresAt),
          cancelToken: ctx.appointment.cancelToken,
        }),
      ),
    );

    await step.sleepUntil("esperar-expiracion", expiresAt);

    const expired = await step.run("expirar-si-sigue-pendiente", async () => {
      const rows = await db
        .update(appointments)
        .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: "pago_expirado", updatedAt: new Date() })
        .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "pending_payment")))
        .returning({ id: appointments.id });
      return rows.length > 0;
    });

    if (expired) {
      // Marca expired los pagos pending de la cita (ficha OXXO / CLABE ya no valen).
      await step.run("expirar-pagos-pendientes", () => expirePendingPaymentsForAppointment(appointmentId));
      await step.sendEvent("emitir-cancelled", {
        name: "appointment/cancelled",
        data: { appointmentId, nutritionistId, by: "system" },
      });
    }
    return { expired };
  },
);

