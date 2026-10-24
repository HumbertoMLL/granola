/**
 * Formateo de fechas/dinero en español de México para los parámetros de
 * plantilla. Se construye a partir de `formatToParts` para que el resultado no
 * dependa de la versión de ICU del runtime.
 */

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

type Parts = { weekday: number; day: number; month: number; year: number; hour: number; minute: number };

function partsIn(date: Date, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(map.weekday ?? "");
  return {
    weekday: wd < 0 ? 0 : wd,
    day: Number(map.day),
    month: Number(map.month) - 1,
    year: Number(map.year),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
  };
}

/** "10:00 a.m." / "6:30 p.m." */
export function formatTimeMx(date: Date, timeZone: string): string {
  const { hour, minute } = partsIn(date, timeZone);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const suffix = hour < 12 ? "a.m." : "p.m.";
  return `${h12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** "jueves 24 de octubre" (agrega el año si no es el año en curso). */
export function formatDateMx(date: Date, timeZone: string, now: Date = new Date()): string {
  const p = partsIn(date, timeZone);
  const base = `${WEEKDAYS[p.weekday]} ${p.day} de ${MONTHS[p.month]}`;
  return p.year === partsIn(now, timeZone).year ? base : `${base} de ${p.year}`;
}

/** "jueves 24 de octubre, 10:00 a.m." — lo que va en {{fecha}} de las plantillas. */
export function formatDateTimeMx(date: Date, timeZone: string, now: Date = new Date()): string {
  return `${formatDateMx(date, timeZone, now)}, ${formatTimeMx(date, timeZone)}`;
}

/** 65000 → "$650.00 MXN". */
export function formatMoneyMx(cents: number, currency = "MXN"): string {
  const amount = (cents / 100).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `$${amount} ${currency}`;
}
