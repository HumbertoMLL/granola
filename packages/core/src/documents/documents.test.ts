import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contentSchema, manualIndicators, parseInBody, parseLabs } from "./index";
const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}.txt`, import.meta.url), "utf8");
describe("Cuando se extraen estudios inventados", () => {
  it("extrae InBody 270 con sus cinco segmentos", () => {
    const p = parseInBody(fixture("inbody270")); expect(p.model).toBe("270"); expect(p.indicators).toHaveLength(12);
    expect(p.indicators.find((i) => i.clave === "weight")?.valor).toBe(72.4);
    expect(p.indicators.find((i) => i.clave === "lean_left_leg")?.valor).toBe(7.8);
    expect(contentSchema.safeParse(p.indicators).success).toBe(true);
  });
  it("extrae 770 en inglés con coma decimal y grasa segmental", () => {
    const p = parseInBody(fixture("inbody770")); expect(p.model).toBe("770"); expect(p.indicators).toHaveLength(17);
    expect(p.indicators.find((i) => i.clave === "muscle")?.valor).toBe(29.4);
    expect(p.indicators.find((i) => i.clave === "fat_trunk")?.valor).toBe(7.8);
    expect(parseInBody(fixture("inbody770").replace("770", "570")).model).toBe("570");
  });
  it("extrae nueve labs, conserva rangos impresos y rellena los ausentes", () => {
    const p = parseLabs(fixture("labs1")); expect(p.indicators).toHaveLength(9);
    expect(p.indicators.find((i) => i.clave === "glucose")).toMatchObject({ valor: 92, rango_min: 70, rango_max: 100 });
    expect(p.indicators.find((i) => i.clave === "ldl")?.rango_max).toBe(130);
    expect(p.indicators.find((i) => i.clave === "cholesterol")?.rango_max).toBe(199);
  });
  it("conserva unidades alternativas sin aplicar referencias de otra unidad", () => {
    const p = parseLabs(fixture("labs2")); expect(p.indicators).toHaveLength(9);
    expect(p.indicators.find((i) => i.clave === "glucose")).toMatchObject({ valor: 5.2, unidad: "mmol/l", rango_min: 3.9, rango_max: 5.5 });
    expect(p.indicators.find((i) => i.clave === "cholesterol")?.rango_max).toBeNull();
    expect(p.indicators.find((i) => i.clave === "vitamin_d")?.rango_max).toBeNull();
  });
  it("no inventa datos con texto vacío, columnas ambiguas o solo una unidad", () => {
    expect(parseInBody("Peso kg\n72.3").indicators).toEqual([]);
    expect(parseLabs("").indicators).toEqual([]);
    expect(manualIndicators("labs").every((i) => !i.visible)).toBe(true);
  });
  it("rechaza duplicados, rangos invertidos y valores no finitos", () => {
    const i = manualIndicators("labs")[0]!;
    expect(contentSchema.safeParse([i,i]).success).toBe(false);
    expect(contentSchema.safeParse([{...i, rango_min: 100, rango_max: 50}]).success).toBe(false);
    expect(contentSchema.safeParse([{...i, valor: Infinity}]).success).toBe(false);
  });
});
