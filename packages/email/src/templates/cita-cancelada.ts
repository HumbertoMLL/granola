import { appointmentDetails, appointmentSchema, renderEmail, type AppointmentEmailInput } from "./shared";

export function citaCancelada(input: AppointmentEmailInput) {
  const d = appointmentSchema.parse(input);
  return renderEmail("Tu cita fue cancelada", [
    `Hola, ${d.patientName}. Tu cita con ${d.nutritionistName} fue cancelada.`,
    ...appointmentDetails(d),
    "Puedes consultar la disponibilidad para reservar otra cita.",
  ], { label: "Agendar otra cita", url: d.manageUrl });
}
