import { body, template, urlButton } from "./_shared";
export type ReporteListoData = {
  patientName: string;
  nutritionistName: string;
  token: string;
};
export function buildReporteListo(d: ReporteListoData) {
  return template("reporte_listo", [
    body(d.patientName, d.nutritionistName),
    urlButton(0, d.token),
  ]);
}
