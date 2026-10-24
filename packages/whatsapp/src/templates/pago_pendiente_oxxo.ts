import { formatDateTimeMx, formatMoneyMx } from "../format";
import { body, template, urlButton } from "./_shared";
import type { TemplateMessage } from "../types";

export type PagoPendienteOxxoData = {
  patientName: string;
  nutritionistName: string;
  startsAt: Date;
  timeZone: string;
  amountCents: number;
  currency?: string;
  /** Hasta cuándo se puede pagar (viene de appointment/pending_payment.expiresAt). */
  expiresAt: Date;
  /** La página /cita/{token} muestra la referencia OXXO / CLABE SPEI. */
  cancelToken: string;
};

/**
 * pago_pendiente_oxxo — al paciente cuando apartó con OXXO/SPEI y falta pagar.
 * {{1}} nombre · {{2}} nutri · {{3}} fecha y hora de la cita · {{4}} monto · {{5}} fecha límite de pago
 * Botón 0 (URL): "Ver referencia de pago" https://{APP}/cita/{{1}}
 */
export function buildPagoPendienteOxxo(d: PagoPendienteOxxoData): TemplateMessage {
  return template("pago_pendiente_oxxo", [
    body(
      d.patientName,
      d.nutritionistName,
      formatDateTimeMx(d.startsAt, d.timeZone),
      formatMoneyMx(d.amountCents, d.currency ?? "MXN"),
      formatDateTimeMx(d.expiresAt, d.timeZone),
    ),
    urlButton(0, d.cancelToken),
  ]);
}
