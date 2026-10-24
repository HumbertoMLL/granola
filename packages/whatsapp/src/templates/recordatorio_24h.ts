import { formatTimeMx } from "../format";
import { QUICK_REPLY, body, modalityDetail, modalityLabel, quickReply, template, urlButton, type Modality } from "./_shared";
import type { TemplateMessage } from "../types";

export type Recordatorio24hData = {
  appointmentId: string;
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
 * recordatorio_24h — 24 h antes. Pide confirmación.
 * {{1}} nombre · {{2}} nutri · {{3}} hora · {{4}} modalidad · {{5}} detalle
 * Botón 0 (quick reply): "Confirmo" payload confirm:{appointmentId}
 * Botón 1 (URL): "Reagendar" https://{APP}/cita/{{1}}
 */
export function buildRecordatorio24h(d: Recordatorio24hData): TemplateMessage {
  return template("recordatorio_24h", [
    body(
      d.patientName,
      d.nutritionistName,
      formatTimeMx(d.startsAt, d.timeZone),
      modalityLabel(d.modality),
      modalityDetail(d.modality, d.meetUrl, d.location),
    ),
    quickReply(0, QUICK_REPLY.confirm(d.appointmentId)),
    urlButton(1, d.cancelToken),
  ]);
}
