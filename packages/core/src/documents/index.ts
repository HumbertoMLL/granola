import { z } from "zod";

export const indicatorSchema = z
  .object({
    clave: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9_]+$/),
    etiqueta: z.string().trim().min(1).max(120),
    valor: z.number().finite().min(-100000).max(100000),
    unidad: z.string().trim().max(30),
    rango_min: z.number().finite().nullable(),
    rango_max: z.number().finite().nullable(),
    visible: z.boolean(),
    comentario: z.string().trim().max(2000),
  })
  .refine(
    (d) =>
      d.rango_min === null ||
      d.rango_max === null ||
      d.rango_min <= d.rango_max,
    "Revisa el rango de referencia",
  );
export const contentSchema = z
  .array(indicatorSchema)
  .max(100)
  .refine(
    (rows) => new Set(rows.map((r) => r.clave)).size === rows.length,
    "Las claves no deben repetirse",
  );
export const brandSchema = z.object({
  logo_url: z.string().max(2000).nullable(),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  firma: z.string().trim().max(500),
});
export type Indicator = z.infer<typeof indicatorSchema>;
export type ReportBrand = z.infer<typeof brandSchema>;
export type ParsedDocument = { model: string | null; indicators: Indicator[] };

type Definition = {
  key: string;
  label: string;
  aliases: string;
  unit: string;
  range?: [number | null, number | null];
};
const inbody: Definition[] = [
  { key: "weight", label: "Peso", aliases: "peso|weight", unit: "kg" },
  {
    key: "muscle",
    label: "Masa muscular esquelética",
    aliases: "masa muscular esqueletica|skeletal muscle mass|mme|smm",
    unit: "kg",
  },
  {
    key: "fat_mass",
    label: "Masa grasa",
    aliases: "masa grasa corporal|masa grasa|body fat mass",
    unit: "kg",
  },
  {
    key: "body_fat",
    label: "Grasa corporal",
    aliases:
      "porcentaje de grasa corporal|porcentaje de grasa|percent body fat|body fat percentage|pgc|pbf|% grasa",
    unit: "%",
  },
  {
    key: "water",
    label: "Agua corporal total",
    aliases: "agua corporal total|total body water|act|tbw",
    unit: "L",
  },
  {
    key: "bmi",
    label: "IMC",
    aliases: "indice de masa corporal|body mass index|imc|bmi",
    unit: "kg/m²",
  },
  {
    key: "bmr",
    label: "Tasa metabólica basal",
    aliases: "tasa metabolica basal|basal metabolic rate|tmb|bmr",
    unit: "kcal",
  },
];
const labs: Definition[] = [
  {
    key: "glucose",
    label: "Glucosa",
    aliases: "glucosa(?: en ayuno)?|glucose",
    unit: "mg/dL",
    range: [70, 99],
  },
  {
    key: "hba1c",
    label: "HbA1c",
    aliases: "hemoglobina glucosilada|hemoglobina glicosilada|hba1c",
    unit: "%",
    range: [null, 5.6],
  },
  {
    key: "cholesterol",
    label: "Colesterol total",
    aliases: "colesterol total|total cholesterol",
    unit: "mg/dL",
    range: [null, 199],
  },
  {
    key: "ldl",
    label: "LDL",
    aliases: "colesterol ldl|ldl(?: colesterol)?",
    unit: "mg/dL",
    range: [null, 99],
  },
  {
    key: "hdl",
    label: "HDL",
    aliases: "colesterol hdl|hdl(?: colesterol)?",
    unit: "mg/dL",
    range: [40, null],
  },
  {
    key: "triglycerides",
    label: "Triglicéridos",
    aliases: "trigliceridos|triglycerides",
    unit: "mg/dL",
    range: [null, 149],
  },
  {
    key: "creatinine",
    label: "Creatinina",
    aliases: "creatinina(?: serica)?|creatinine",
    unit: "mg/dL",
    range: [0.6, 1.3],
  },
  {
    key: "tsh",
    label: "TSH",
    aliases: "tsh|hormona estimulante de la tiroides",
    unit: "mIU/L",
    range: [0.4, 4],
  },
  {
    key: "vitamin_d",
    label: "Vitamina D",
    aliases: "vitamina d(?: 25[- ]oh)?|25[- ]oh vitamina d|vitamin d",
    unit: "ng/mL",
    range: [20, 50],
  },
];
const segments = [
  ["right_arm", "Brazo derecho", "brazo derecho|right arm"],
  ["left_arm", "Brazo izquierdo", "brazo izquierdo|left arm"],
  ["trunk", "Tronco", "tronco|trunk"],
  ["right_leg", "Pierna derecha", "pierna derecha|right leg"],
  ["left_leg", "Pierna izquierda", "pierna izquierda|left leg"],
] as const;
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const numeric = "(-?\\d+(?:[.,]\\d+)?)";
const number = (s: string) => Number(s.replace(",", "."));

/** Extracción conservadora de líneas etiquetadas. No adivina columnas ni valores ausentes. */
function extract(text: string, definitions: Definition[]): Indicator[] {
  const lines = text.split(/\r?\n/).map((s) => normalize(s.trim()));
  return definitions.flatMap((d) => {
    const pattern = new RegExp(
      `^(?:${d.aliases})\\s*(?:\\((?<before>[^)]*)\\))?\\s*[:=]?\\s*(?<value>-?\\d+(?:[.,]\\d+)?)(?<tail>.*)$`,
      "i",
    );
    const match = lines.map((line) => line.match(pattern)).find(Boolean);
    if (!match?.groups) return [];
    const tail = match.groups.tail ?? "";
    const unit =
      tail.match(/^\s*(%|[a-zµμ]+(?:\/[a-zµμ0-9²³]+)?)/i)?.[1] ||
      match.groups.before?.trim();
    const printedRange = tail.match(
      new RegExp(`${numeric}\\s*(?:-|a|–)\\s*${numeric}`),
    );
    // Un rango por defecto solo es válido para la misma unidad; nunca se convierte implícitamente.
    const sameUnit =
      !unit ||
      normalize(unit) === normalize(d.unit) ||
      (["uiu/ml", "µiu/ml"].includes(unit) && d.key === "tsh");
    const range = printedRange
      ? [number(printedRange[1]!), number(printedRange[2]!)]
      : sameUnit
        ? d.range
        : undefined;
    return [
      {
        clave: d.key,
        etiqueta: d.label,
        valor: number(match.groups.value!),
        unidad: unit || d.unit,
        rango_min: range?.[0] ?? null,
        rango_max: range?.[1] ?? null,
        visible: true,
        comentario: "",
      },
    ];
  });
}
export function parseInBody(text: string): ParsedDocument {
  const model = text.match(/inbody\s*(270|570|770)/i)?.[1] ?? null;
  const segmentDefs: Definition[] = segments.flatMap(
    ([key, label, aliases]) => [
      {
        key: `lean_${key}`,
        label: `Masa magra · ${label}`,
        aliases: `(?:masa magra|lean) (?:${aliases})`,
        unit: "kg",
      },
      {
        key: `fat_${key}`,
        label: `Grasa · ${label}`,
        aliases: `(?:grasa|fat) (?:${aliases})`,
        unit: "kg",
      },
    ],
  );
  let section: "lean" | "fat" | null = null;
  const normalized = text
    .split(/\r?\n/)
    .map((line) => {
      const lower = normalize(line.trim());
      if (/masa magra segmental|segmental lean/.test(lower)) section = "lean";
      else if (/grasa segmental|segmental fat/.test(lower)) section = "fat";
      if (
        section &&
        segments.some(([, , aliases]) =>
          new RegExp(`^(?:${aliases})\\s*[:(=0-9]`).test(lower),
        )
      )
        return `${section} ${line}`;
      return line;
    })
    .join("\n");
  return {
    model,
    indicators: extract(normalized, [...inbody, ...segmentDefs]),
  };
}
export function parseLabs(text: string): ParsedDocument {
  return { model: null, indicators: extract(text, labs) };
}
export function manualIndicators(template: "inbody" | "labs"): Indicator[] {
  return (template === "inbody" ? inbody : labs).map((d) => ({
    clave: d.key,
    etiqueta: d.label,
    valor: 0,
    unidad: d.unit,
    rango_min: d.range?.[0] ?? null,
    rango_max: d.range?.[1] ?? null,
    visible: false,
    comentario: "",
  }));
}

export function formatIndicatorRange(i: Indicator) {
  if (i.rango_min === null && i.rango_max === null)
    return "Sin rango registrado";
  if (i.rango_min === null) return `Hasta ${i.rango_max} ${i.unidad}`;
  if (i.rango_max === null) return `Desde ${i.rango_min} ${i.unidad}`;
  return `${i.rango_min} - ${i.rango_max} ${i.unidad}`;
}
