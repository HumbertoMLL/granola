import { appointmentDetails, appointmentSchema, renderEmail, type AppointmentEmailInput } from "./shared";

export function nuevaCitaNutri(input: AppointmentEmailInput) {
  const d = appointmentSchema.parse(input);
  return renderEmail("Tienes una nueva cita en Granola", [
    `Hola, ${d.nutritionistName}. ${d.patientName} tiene una cita confirmada contigo.`,
    ...appointmentDetails(d),
  ], { label: "Ver cita en mi agenda", url: d.manageUrl });
}
