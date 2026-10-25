import { z } from "zod";

export const patientSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre completo").max(200),
  phoneWa: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Usa formato internacional: +525512345678"),
  email: z.union([z.email(), z.literal("")]).default(""),
  birthDate: z.union([z.iso.date(), z.literal("")]).default(""),
  sex: z.enum(["f", "m", "otro", ""]).default(""),
  notes: z.string().trim().max(10000).default(""),
  consent: z.literal(true, { error: "Se requiere consentimiento expreso para datos de salud" }),
});

function decimal(max: number, places: number, zero = false) {
  return z
    .string()
    .trim()
    .refine(
      (s) =>
        s === "" ||
        (new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(s) &&
          Number(s) <= max &&
          (zero ? Number(s) >= 0 : Number(s) > 0)),
      `Usa un valor ${zero ? "desde 0" : "mayor que 0"} hasta ${max}, con máximo ${places} decimales`,
    )
    .transform((s) => s || null);
}
export const measurementSchema = z
  .object({
    measuredAt: z.iso.datetime({ offset: true }),
    weightKg: decimal(600, 2),
    heightCm: decimal(250, 1),
    waistCm: decimal(400, 1),
    hipCm: decimal(400, 1),
    bodyFatPct: decimal(100, 2, true),
    muscleKg: decimal(600, 2),
    notes: z.string().trim().max(10000),
  })
  .refine(
    (d) => [d.weightKg, d.heightCm, d.waistCm, d.hipCm, d.bodyFatPct, d.muscleKg].some((v) => v !== null),
    "Captura al menos una medición",
  );
export const noteSchema = z.object({
  kind: z.enum(["consulta", "nota", "antecedente"]),
  body: z.string().trim().min(1, "Escribe la nota").max(30000),
  appointmentId: z.uuid().nullable(),
});
export const recordRequestSchema = z.object({ patientId: z.uuid(), appointmentId: z.uuid().optional() });
