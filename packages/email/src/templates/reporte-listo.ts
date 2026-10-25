import { z } from "zod";
import { linkSchema, nameSchema, renderEmail } from "./shared";
export function reporteListo(input: {
  patientName: string;
  nutritionistName: string;
  reportUrl: string;
}) {
  const d = z
    .object({
      patientName: nameSchema,
      nutritionistName: nameSchema,
      reportUrl: linkSchema,
    })
    .parse(input);
  return renderEmail(
    "Tu reporte está listo",
    [
      `Hola, ${d.patientName}.`,
      `${d.nutritionistName} preparó tu reporte personalizado. El enlace privado vence en 7 días. No lo compartas.`,
    ],
    { label: "Ver mi reporte", url: d.reportUrl },
  );
}
