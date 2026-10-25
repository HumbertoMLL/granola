import { z } from "zod";

const positive = z.number().finite().positive();
export type BmiClassification = "bajo_peso" | "normal" | "sobrepeso" | "obesidad_i" | "obesidad_ii" | "obesidad_iii";

/** OMS, adultos. Clasifica el valor sin redondear para conservar los umbrales. */
export function classifyBmi(bmi: number): BmiClassification {
  positive.parse(bmi);
  if (bmi < 18.5) return "bajo_peso";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "sobrepeso";
  if (bmi < 35) return "obesidad_i";
  if (bmi < 40) return "obesidad_ii";
  return "obesidad_iii";
}

export function calculateBmi(weightKg: number, heightCm: number) {
  const value = positive.parse(weightKg) / (positive.parse(heightCm) / 100) ** 2;
  positive.parse(value);
  return { value, classification: classifyBmi(value) };
}

export function waistHipRatio(waistCm: number, hipCm: number): number {
  return positive.parse(positive.parse(waistCm) / positive.parse(hipCm));
}

export function waistHeightRatio(waistCm: number, heightCm: number): number {
  return positive.parse(positive.parse(waistCm) / positive.parse(heightCm));
}

export const energyInputSchema = z.object({
  weightKg: positive.max(600),
  heightCm: positive.max(250),
  ageYears: z.number().int().min(18).max(120),
  // Sexo usado por las ecuaciones originales; nunca se infiere de "otro".
  sex: z.enum(["f", "m"]),
  activityFactor: z.number().finite().min(1).max(2.5),
});
export type EnergyInput = z.infer<typeof energyInputSchema>;
export type EnergyFormula = "mifflin" | "harris_benedict";

/** GET en kcal/día. Harris-Benedict revisada por Roza y Shizgal (1984). */
export function totalEnergyExpenditure(input: EnergyInput, formula: EnergyFormula = "mifflin"): number {
  const d = energyInputSchema.parse(input);
  z.enum(["mifflin", "harris_benedict"]).parse(formula);
  const resting = formula === "mifflin"
    ? 10 * d.weightKg + 6.25 * d.heightCm - 5 * d.ageYears + (d.sex === "m" ? 5 : -161)
    : d.sex === "m"
      ? 88.362 + 13.397 * d.weightKg + 4.799 * d.heightCm - 5.677 * d.ageYears
      : 447.593 + 9.247 * d.weightKg + 3.098 * d.heightCm - 4.330 * d.ageYears;
  return positive.parse(resting * d.activityFactor);
}

/** Ajuste proporcional definido por el profesional. 20% por defecto; sin redondeo. */
export function energyForGoal(totalKcal: number, goal: "deficit" | "maintenance" | "surplus", adjustment = 0.2): number {
  positive.parse(totalKcal);
  z.enum(["deficit", "maintenance", "surplus"]).parse(goal);
  z.number().finite().min(0).max(0.5).parse(adjustment);
  return positive.parse(totalKcal * (goal === "deficit" ? 1 - adjustment : goal === "surplus" ? 1 + adjustment : 1));
}
