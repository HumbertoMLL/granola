import { formatDateTimeMx } from "../format";
import { body, modalityDetail, modalityLabel, template, urlButton, type Modality } from "./_shared";
import type { TemplateMessage } from "../types";

export type CitaConfirmadaData = {
  patientName: string;
  nutritionistName: string;
  startsAt: Date;
  /** Zona en la que se formatea la hora (la del nutri; el paciente no tiene zona en F1). */
  timeZone: string;
  modality: Modality;
  meetUrl?: string | null;
  location?: string | null;
  /** Sufijo del botón "Reagendar o cancelar" → /cita/{cancelToken}. */
  cancelToken: string;
};

/**
 * cita_confirmada — al paciente cuando la cita queda confirmada.
 * {{1}} nombre paciente · {{2}} nombre nutri · {{3}} fecha y hora · {{4}} modalidad · {{5}} detalle (Meet/dirección)
 * Botón 0 (URL): https://{APP}/cita/{{1}}
 */
export function buildCitaConfirmada(d: CitaConfirmadaData): TemplateMessage {
  return template("cita_confirmada", [
    body(
      d.patientName,
      d.nutritionistName,
      formatDateTimeMx(d.startsAt, d.timeZone),
      modalityLabel(d.modality),
      modalityDetail(d.modality, d.meetUrl, d.location),
    ),
    urlButton(0, d.cancelToken),
  ]);
}
