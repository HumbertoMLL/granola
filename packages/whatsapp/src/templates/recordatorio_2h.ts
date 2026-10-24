import { formatTimeMx } from "../format";
import { body, modalityDetail, modalityLabel, template, urlButton, type Modality } from "./_shared";
import type { TemplateMessage } from "../types";

export type Recordatorio2hData = {
  patientName: string;
  nutritionistName: string;
  startsAt: Date;
  timeZone: string;
  modality: Modality;
  meetUrl?: string | null;
  location?: string | null;
  cancelToken: string;
};

/**
 * recordatorio_2h — 2 h antes.
 * {{1}} nombre · {{2}} nutri · {{3}} hora · {{4}} modalidad · {{5}} detalle
 * Botón 0 (URL): "Ver mi cita" https://{APP}/cita/{{1}}
 */
export function buildRecordatorio2h(d: Recordatorio2hData): TemplateMessage {
  return template("recordatorio_2h", [
    body(
      d.patientName,
      d.nutritionistName,
      formatTimeMx(d.startsAt, d.timeZone),
      modalityLabel(d.modality),
      modalityDetail(d.modality, d.meetUrl, d.location),
    ),
    urlButton(0, d.cancelToken),
  ]);
}
