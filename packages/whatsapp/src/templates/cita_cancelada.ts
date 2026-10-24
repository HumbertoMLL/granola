import { formatDateTimeMx } from "../format";
import { body, template, urlButton } from "./_shared";
import type { TemplateMessage } from "../types";

export type CitaCanceladaData = {
  patientName: string;
  nutritionistName: string;
  startsAt: Date;
  timeZone: string;
  /** Quién canceló; define el texto de {{4}}. */
  by: "patient" | "nutritionist" | "system";
  /** Slug de la página pública → botón "Agendar otra cita" https://{APP}/{{1}}. */
  nutritionistSlug: string;
};

export function cancelReasonLabel(by: CitaCanceladaData["by"], nutritionistName: string): string {
  switch (by) {
    case "patient":
      return "a petición tuya";
    case "nutritionist":
      return `por ${nutritionistName}`;
    case "system":
      return "porque no se completó el pago a tiempo";
  }
}

/**
 * cita_cancelada — al paciente cuando se cancela.
 * {{1}} nombre · {{2}} nutri · {{3}} fecha y hora · {{4}} motivo ("a petición tuya" / "por {nutri}" / "porque no se completó el pago a tiempo")
 * Botón 0 (URL): "Agendar otra cita" https://{APP}/{{1}} (slug)
 */
export function buildCitaCancelada(d: CitaCanceladaData): TemplateMessage {
  return template("cita_cancelada", [
    body(d.patientName, d.nutritionistName, formatDateTimeMx(d.startsAt, d.timeZone), cancelReasonLabel(d.by, d.nutritionistName)),
    urlButton(0, d.nutritionistSlug),
  ]);
}
