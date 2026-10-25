import { appointmentDetails, appointmentSchema, renderEmail, type AppointmentEmailInput } from "./shared";

export function citaConfirmadaPaciente(input: AppointmentEmailInput) {
  const d = appointmentSchema.parse(input);
  return renderEmail("Tu cita está confirmada", [
    `Hola, ${d.patientName}. Tu cita con ${d.nutritionistName} está confirmada.`,
    ...appointmentDetails(d),
    "Si necesitas cambiar o cancelar tu cita, usa el siguiente enlace.",
  ], { label: "Administrar mi cita", url: d.manageUrl });
}
