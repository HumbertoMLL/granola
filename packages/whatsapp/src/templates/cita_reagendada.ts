import { formatDateTimeMx } from "../format";
import { body, modalityDetail, modalityLabel, template, urlButton, type Modality } from "./_shared";
import type { TemplateMessage } from "../types";

export type CitaReagendadaData = {
  patientName: string;
  nutritionistName: string;
  previousStartsAt: Date;
  startsAt: Date;
  timeZone: string;
  modality: Modality;
  meetUrl?: string | null;
  location?: string | null;
  cancelToken: string;
};

/**
 * cita_reagendada — al paciente cuando cambia la fecha.
 * {{1}} nombre · {{2}} nutri · {{3}} fecha anterior · {{4}} fecha nueva · {{5}} modalidad · {{6}} detalle
 * Botón 0 (URL): "Reagendar o cancelar" https://{APP}/cita/{{1}}
 */
export function buildCitaReagendada(d: CitaReagendadaData): TemplateMessage {
  return template("cita_reagendada", [
    body(
      d.patientName,
      d.nutritionistName,
      formatDateTimeMx(d.previousStartsAt, d.timeZone),
      formatDateTimeMx(d.startsAt, d.timeZone),
      modalityLabel(d.modality),
      modalityDetail(d.modality, d.meetUrl, d.location),
    ),
    urlButton(0, d.cancelToken),
  ]);
}
