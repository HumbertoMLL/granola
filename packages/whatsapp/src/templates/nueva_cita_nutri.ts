import { formatDateTimeMx } from "../format";
import { body, modalityLabel, template, urlButton, type Modality } from "./_shared";
import type { TemplateMessage } from "../types";

export type NuevaCitaNutriData = {
  appointmentId: string;
  patientName: string;
  serviceName: string;
  startsAt: Date;
  /** Zona del nutri. */
  timeZone: string;
  modality: Modality;
  /** Texto libre corto: "pagado con tarjeta", "pago pendiente (OXXO)", "se cobra en consulta". */
  paymentLabel: string;
};

/**
 * nueva_cita_nutri — al nutriólogo cuando alguien agenda.
 * {{1}} nombre paciente · {{2}} servicio · {{3}} fecha y hora · {{4}} modalidad · {{5}} estado de pago
 * Botón 0 (URL): "Ver en mi agenda" https://{APP}/app/agenda/{{1}} (appointmentId)
 */
export function buildNuevaCitaNutri(d: NuevaCitaNutriData): TemplateMessage {
  return template("nueva_cita_nutri", [
    body(d.patientName, d.serviceName, formatDateTimeMx(d.startsAt, d.timeZone), modalityLabel(d.modality), d.paymentLabel),
    urlButton(0, d.appointmentId),
  ]);
}
