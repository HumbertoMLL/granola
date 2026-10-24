import { body, template, urlButton } from "./_shared";
import type { TemplateMessage } from "../types";

export type PideResenaData = {
  patientName: string;
  nutritionistName: string;
  /** Sufijo del botón "Dejar reseña" → https://{APP}/resena/{{1}} (mismo cancelToken de la cita). */
  cancelToken: string;
};

/**
 * pide_resena — 2 h después de terminar la cita.
 * {{1}} nombre · {{2}} nutri
 * Botón 0 (URL): "Dejar reseña" https://{APP}/resena/{{1}}
 */
export function buildPideResena(d: PideResenaData): TemplateMessage {
  return template("pide_resena", [body(d.patientName, d.nutritionistName), urlButton(0, d.cancelToken)]);
}
