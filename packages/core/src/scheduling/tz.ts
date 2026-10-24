/**
 * Helpers de zona horaria sin dependencias: todo sale de `Intl.DateTimeFormat`,
 * que está disponible igual en Node y en el navegador. Las fechas "civiles"
 * (día/hora local del nutri) viajan como strings `YYYY-MM-DD` y `HH:MM[:SS]`;
 * los instantes siempre como `Date` (UTC).
 */

export type Ymd = string; // "2026-03-08"
export type Hm = string; // "09:00" | "09:00:00"

export type ZonedParts = {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
  /** 0 = domingo … 6 = sábado (convención JS). */
  weekday: number;
};

const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsCache.set(timeZone, fmt);
  }
  return fmt;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidTimeZone(timeZone: string): boolean {
  try {
    partsFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** Descompone un instante en sus partes civiles dentro de `timeZone`. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    // Algunos motores devuelven "24" para medianoche con hourCycle h23 (bug histórico).
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS[get("weekday")] ?? 0,
  };
}

/** Offset de la zona respecto a UTC en ms (p. ej. America/Mexico_City → -6h). */
export function getTimeZoneOffsetMs(timeZone: string, date: Date): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Quitamos los ms del instante para comparar a resolución de segundos.
  return asUtc - (date.getTime() - (date.getTime() % 1000));
}

export function parseYmd(ymd: Ymd): { year: number; month: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new Error(`Fecha inválida: ${ymd}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** "09:30" | "09:30:00" → minutos desde medianoche. */
export function parseTimeToMinutes(hm: Hm): number {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hm);
  if (!m) throw new Error(`Hora inválida: ${hm}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) throw new Error(`Hora inválida: ${hm}`);
  return h * 60 + min;
}

export function minutesToTime(minutes: number): Hm {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatYmd(year: number, month: number, day: number): Ymd {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Día civil (YYYY-MM-DD) en que cae el instante dentro de la zona. */
export function ymdInTz(date: Date, timeZone: string): Ymd {
  const p = getZonedParts(date, timeZone);
  return formatYmd(p.year, p.month, p.day);
}

/** Suma días a una fecha civil (aritmética pura de calendario, sin zona). */
export function addDaysYmd(ymd: Ymd, days: number): Ymd {
  const { year, month, day } = parseYmd(ymd);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function compareYmd(a: Ymd, b: Ymd): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = domingo … 6 = sábado de una fecha civil. */
export function weekdayOfYmd(ymd: Ymd): number {
  const { year, month, day } = parseYmd(ymd);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * Convierte fecha + hora civiles de `timeZone` al instante UTC. Robusto ante
 * cambios de horario: si la hora local no existe (hueco de DST) devuelve el
 * instante equivalente tras el salto; si existe dos veces, la primera.
 */
export function zonedTimeToUtc(ymd: Ymd, minutesFromMidnight: number, timeZone: string): Date {
  const { year, month, day } = parseYmd(ymd);
  const guess = Date.UTC(year, month - 1, day, 0, minutesFromMidnight, 0);
  const offset1 = getTimeZoneOffsetMs(timeZone, new Date(guess));
  let utc = guess - offset1;
  const offset2 = getTimeZoneOffsetMs(timeZone, new Date(utc));
  if (offset2 !== offset1) {
    // Estamos en una transición. Probamos con el segundo offset; nos quedamos con
    // el candidato cuyo "round trip" devuelve la hora pedida (o el más temprano).
    const alt = guess - offset2;
    const altOk = getTimeZoneOffsetMs(timeZone, new Date(alt)) === offset2;
    const utcOk = getTimeZoneOffsetMs(timeZone, new Date(utc)) === offset1;
    if (altOk && (!utcOk || alt < utc)) utc = alt;
  }
  return new Date(utc);
}

export type FormatInTzOptions = Intl.DateTimeFormatOptions & { locale?: string };

/** Formatea un instante en la zona dada (es-MX por defecto). */
export function formatInTz(date: Date, timeZone: string, options: FormatInTzOptions = {}): string {
  const { locale = "es-MX", ...rest } = options;
  return new Intl.DateTimeFormat(locale, { timeZone, ...rest }).format(date);
}

/** "10:30" en la zona (24h). */
export function formatTimeInTz(date: Date, timeZone: string, locale = "es-MX"): string {
  return formatInTz(date, timeZone, { locale, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** "lunes, 9 de marzo de 2026" en la zona. */
export function formatDateInTz(date: Date, timeZone: string, locale = "es-MX"): string {
  return formatInTz(date, timeZone, {
    locale,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Fecha civil YYYY-MM-DD → "lunes, 9 de marzo" (sin zona, puro calendario). */
export function formatYmdLong(ymd: Ymd, locale = "es-MX", options: Intl.DateTimeFormatOptions = {}): string {
  const { year, month, day } = parseYmd(ymd);
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...options,
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Nombre corto de la zona ("GMT-6", "CST") para mostrar junto a la hora. */
export function timeZoneLabel(timeZone: string, date: Date = new Date(), locale = "es-MX"): string {
  const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: "short" }).formatToParts(date);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
}
