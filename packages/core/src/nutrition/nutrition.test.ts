import { describe, expect, it } from "vitest";
import { calculateBmi, classifyBmi, energyForGoal, totalEnergyExpenditure, waistHeightRatio, waistHipRatio } from "./index";

describe("antropometría adulta", () => {
  it("convierte centímetros a metros", () => {
    expect(calculateBmi(70, 175).value).toBeCloseTo(22.857142857);
    expect(calculateBmi(70, 175).classification).toBe("normal");
  });
  it.each([
    [18.499, "bajo_peso"], [18.5, "normal"], [24.999, "normal"],
    [25, "sobrepeso"], [29.999, "sobrepeso"], [30, "obesidad_i"],
    [34.999, "obesidad_i"], [35, "obesidad_ii"], [39.999, "obesidad_ii"], [40, "obesidad_iii"],
  ] as const)("clasifica %s sin redondeo", (value, classification) => expect(classifyBmi(value)).toBe(classification));
  it("calcula índices con las mismas unidades", () => {
    expect(waistHipRatio(80, 100)).toBe(0.8);
    expect(waistHeightRatio(80, 160)).toBe(0.5);
  });
  it.each([0, -1, NaN, Infinity])("rechaza mediciones inválidas %s", (value) => {
    expect(() => calculateBmi(70, value)).toThrow();
    expect(() => calculateBmi(value, 170)).toThrow();
    expect(() => waistHipRatio(80, value)).toThrow();
    expect(() => waistHeightRatio(value, 170)).toThrow();
    expect(() => classifyBmi(value)).toThrow();
  });
});

describe("requerimientos", () => {
  const input = { weightKg: 70, heightCm: 175, ageYears: 30, sex: "m" as const, activityFactor: 1.2 };
  it("Mifflin-St Jeor para ambos sexos", () => {
    expect(totalEnergyExpenditure(input)).toBeCloseTo(1978.5);
    expect(totalEnergyExpenditure({ ...input, sex: "f" })).toBeCloseTo(1779.3);
  });
  it("Harris-Benedict revisada para ambos sexos", () => {
    expect(totalEnergyExpenditure(input, "harris_benedict")).toBeCloseTo(2034.8004);
    expect(totalEnergyExpenditure({ ...input, sex: "f" }, "harris_benedict")).toBeCloseTo(1808.5596);
  });
  it("aplica el factor sin redondear el gasto basal", () => {
    expect(totalEnergyExpenditure({ ...input, activityFactor: 1.55 })).toBeCloseTo(1648.75 * 1.55);
  });
  it("ajusta el GET por objetivo", () => {
    expect(energyForGoal(2000, "deficit")).toBe(1600);
    expect(energyForGoal(2000, "maintenance")).toBe(2000);
    expect(energyForGoal(2000, "surplus", 0.1)).toBe(2200);
    expect(energyForGoal(2000, "deficit", 0)).toBe(2000);
  });
  it("rechaza menores, valores no finitos y ajustes fuera del rango", () => {
    for (const change of [{ ageYears: 17 }, { ageYears: 30.5 }, { activityFactor: 0 }, { weightKg: NaN }, { heightCm: 0 }]) {
      expect(() => totalEnergyExpenditure({ ...input, ...change })).toThrow();
    }
    expect(() => energyForGoal(2000, "deficit", 1)).toThrow();
    expect(() => energyForGoal(Infinity, "maintenance")).toThrow();
  });
});
