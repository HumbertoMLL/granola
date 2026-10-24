/**
 * Cálculo de slots disponibles. Puro: recibe reglas, excepciones y citas,
 * devuelve intervalos UTC. Sin IO (regla dura #2).
 */
import {
  addDaysYmd,
  compareYmd,
  parseTimeToMinutes,
  weekdayOfYmd,
  ymdInTz,
  zonedTimeToUtc,
  type Hm,
  type Ymd,
} from "./tz";

export type AvailabilityRule = {
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  startTime: Hm;
  endTime: Hm;
};

export type AvailabilityOverride = {
  date: Ymd;
  /** Null + isBlocked = día completo bloqueado. */
  startTime: Hm | null;
  endTime: Hm | null;
  /** true = bloquea; false = ventana extra ese día. */
  isBlocked: boolean;
};

export type Interval = { startsAt: Date; endsAt: Date };
export type Slot = Interval;

export type ServiceDuration = { durationMin: number };

export type ComputeSlotsInput = {
  rules: AvailabilityRule[];
  overrides: AvailabilityOverride[];
  /** Citas existentes (y bloqueos de Google) en UTC. */
  busy: Interval[];
  service: ServiceDuration;
  /** Rango a calcular (UTC). */
  from: Date;
  to: Date;
  /** Zona del nutri; las reglas se interpretan en ella. */
  timezone: string;
  now?: Date;
  /** Minutos libres antes y después de cada cita. */
  bufferMin?: number;
  /** Aviso mínimo: no se ofrecen slots que empiecen antes de now + minNoticeMin. */
  minNoticeMin?: number;
  /** Paso entre inicios de slot (15 | 30 …). */
  stepMin?: number;
};

export const DEFAULT_STEP_MIN = 30;
export const DEFAULT_BUFFER_MIN = 0;
export const DEFAULT_MIN_NOTICE_MIN = 120;

/** Ventana en minutos locales [start, end) dentro de un día civil. */
type LocalWindow = { start: number; end: number };

function toWindow(startTime: Hm, endTime: Hm): LocalWindow | null {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  return end > start ? { start, end } : null;
}

function subtractWindow(windows: LocalWindow[], block: LocalWindow): LocalWindow[] {
  const out: LocalWindow[] = [];
  for (const w of windows) {
    if (block.end <= w.start || block.start >= w.end) {
      out.push(w);
      continue;
    }
    if (block.start > w.start) out.push({ start: w.start, end: block.start });
    if (block.end < w.end) out.push({ start: block.end, end: w.end });
  }
  return out;
}

function mergeWindows(windows: LocalWindow[]): LocalWindow[] {
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const out: LocalWindow[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w.start <= last.end) {
      last.end = Math.max(last.end, w.end);
    } else {
      out.push({ ...w });
    }
  }
  return out;
}

/**
 * Ventanas de atención (minutos locales) para un día civil concreto:
 * reglas del weekday − bloqueos del día + ventanas extra del día.
 */
export function windowsForDay(
  ymd: Ymd,
  rules: AvailabilityRule[],
  overrides: AvailabilityOverride[],
): LocalWindow[] {
  const dayOverrides = overrides.filter((o) => o.date === ymd);
  if (dayOverrides.some((o) => o.isBlocked && (o.startTime === null || o.endTime === null))) {
    return [];
  }

  const weekday = weekdayOfYmd(ymd);
  let windows: LocalWindow[] = [];
  for (const r of rules) {
    if (r.weekday !== weekday) continue;
    const w = toWindow(r.startTime, r.endTime);
    if (w) windows.push(w);
  }

  for (const o of dayOverrides) {
    if (o.isBlocked || o.startTime === null || o.endTime === null) continue;
    const w = toWindow(o.startTime, o.endTime);
    if (w) windows.push(w);
  }
  windows = mergeWindows(windows);

  for (const o of dayOverrides) {
    if (!o.isBlocked || o.startTime === null || o.endTime === null) continue;
    const b = toWindow(o.startTime, o.endTime);
    if (b) windows = subtractWindow(windows, b);
  }
  return windows;
}

function overlapsBusy(slot: Interval, busy: Interval[], bufferMs: number): boolean {
  const s = slot.startsAt.getTime() - bufferMs;
  const e = slot.endsAt.getTime() + bufferMs;
  return busy.some((b) => s < b.endsAt.getTime() && e > b.startsAt.getTime());
}

/**
 * Slots disponibles entre `from` y `to` (UTC), ordenados y sin duplicados.
 * Cada slot empieza alineado a `stepMin` desde el inicio de la ventana.
 */
export function computeSlots(input: ComputeSlotsInput): Slot[] {
  const {
    rules,
    overrides,
    busy,
    service,
    from,
    to,
    timezone,
    now = new Date(),
    bufferMin = DEFAULT_BUFFER_MIN,
    minNoticeMin = DEFAULT_MIN_NOTICE_MIN,
    stepMin = DEFAULT_STEP_MIN,
  } = input;

  if (!(service.durationMin > 0) || !(stepMin > 0) || to <= from) return [];

  const durationMs = service.durationMin * 60_000;
  const bufferMs = Math.max(0, bufferMin) * 60_000;
  const earliestStart = Math.max(from.getTime(), now.getTime() + Math.max(0, minNoticeMin) * 60_000);
  const latestEnd = to.getTime();

  // Un día antes/después por si la zona del nutri cruza medianoche UTC.
  const firstDay = addDaysYmd(ymdInTz(from, timezone), -1);
  const lastDay = addDaysYmd(ymdInTz(to, timezone), 1);

  const slots: Slot[] = [];
  const seen = new Set<number>();

  for (let day = firstDay; compareYmd(day, lastDay) <= 0; day = addDaysYmd(day, 1)) {
    for (const w of windowsForDay(day, rules, overrides)) {
      const windowStart = zonedTimeToUtc(day, w.start, timezone).getTime();
      const windowEnd = zonedTimeToUtc(day, w.end, timezone).getTime();
      for (let start = windowStart; start + durationMs <= windowEnd; start += stepMin * 60_000) {
        const end = start + durationMs;
        if (start < earliestStart) continue;
        if (end > latestEnd) break;
        if (seen.has(start)) continue;
        const slot: Slot = { startsAt: new Date(start), endsAt: new Date(end) };
        if (overlapsBusy(slot, busy, bufferMs)) continue;
        seen.add(start);
        slots.push(slot);
      }
    }
  }

  return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

export type DaySlots = { date: Ymd; slots: Slot[] };

/** Agrupa slots por día civil en la zona indicada (la del paciente al mostrar). */
export function groupSlotsByDay(slots: Slot[], timezone: string): DaySlots[] {
  const map = new Map<Ymd, Slot[]>();
  for (const s of slots) {
    const key = ymdInTz(s.startsAt, timezone);
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => compareYmd(a, b))
    .map(([date, daySlots]) => ({
      date,
      slots: daySlots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    }));
}

export type IsSlotAvailableInput = Omit<ComputeSlotsInput, "from" | "to"> & {
  slot: Interval;
};

/**
 * Valida en servidor que el slot pedido sea exactamente uno de los que se
 * ofrecerían (ventanas, excepciones, citas, buffer, aviso mínimo y alineación).
 */
export function isSlotAvailable(input: IsSlotAvailableInput): boolean {
  const { slot, ...rest } = input;
  const expectedEnd = slot.startsAt.getTime() + rest.service.durationMin * 60_000;
  if (slot.endsAt.getTime() !== expectedEnd) return false;

  // Ventana de un día alrededor del slot: suficiente para cualquier zona.
  const from = new Date(slot.startsAt.getTime() - 24 * 3_600_000);
  const to = new Date(slot.endsAt.getTime() + 24 * 3_600_000);
  const target = slot.startsAt.getTime();
  return computeSlots({ ...rest, from, to }).some((s) => s.startsAt.getTime() === target);
}
