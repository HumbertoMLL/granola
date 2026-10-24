import { onAppointmentCancelled } from "./appointment-cancelled";
import { onAppointmentCompleted } from "./appointment-completed";
import { onAppointmentConfirmed } from "./appointment-confirmed";
import { onAppointmentRescheduled } from "./appointment-rescheduled";
import { onPendingPayment } from "./pending-payment";

export { onAppointmentCancelled, onAppointmentCompleted, onAppointmentConfirmed, onAppointmentRescheduled, onPendingPayment };

/** Lista para `serve({ client: inngest, functions })` en apps/web/src/app/api/inngest/route.ts. */
export const functions = [
  onAppointmentConfirmed,
  onAppointmentCancelled,
  onAppointmentRescheduled,
  onPendingPayment,
  onAppointmentCompleted,
];
