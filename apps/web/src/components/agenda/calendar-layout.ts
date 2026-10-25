import {
  addDaysYmd,
  computeSlots,
  getZonedParts,
  ymdInTz,
  zonedTimeToUtc,
} from "@granola/core/scheduling";
import type { TimelineRange } from "@granola/ui";
import type { AgendaData } from "./agenda-tabs";

export function minuteInZone(iso: string, timezone: string): number {
  const parts = getZonedParts(new Date(iso), timezone);
  return parts.hour * 60 + parts.minute;
}

/** Huecos ofrecibles para el servicio más corto, respetando reglas, bloqueos, buffer y antelación. */
export function freeRangesForDay(
  data: AgendaData,
  date: string,
  now: Date,
): TimelineRange[] {
  const active = data.services
    .filter((s) => s.isActive)
    .sort((a, b) => a.durationMin - b.durationMin);
  const service = active[0];
  if (!service) return [];
  const slots = computeSlots({
    rules: data.rules,
    overrides: data.overrides,
    busy: data.appointments
      .filter((a) => a.status !== "cancelled")
      .map((a) => ({
        startsAt: new Date(a.startsAt),
        endsAt: new Date(a.endsAt),
      })),
    service,
    timezone: data.timezone,
    from: zonedTimeToUtc(date, 0, data.timezone),
    to: zonedTimeToUtc(addDaysYmd(date, 1), 0, data.timezone),
    now,
    bufferMin: data.scheduling.bufferMin,
    minNoticeMin: data.scheduling.minNoticeMin,
    stepMin: data.scheduling.slotStepMin,
  });
  const ranges: TimelineRange[] = [];
  for (const slot of slots) {
    const startMinute = minuteInZone(
      slot.startsAt.toISOString(),
      data.timezone,
    );
    const endMinute =
      ymdInTz(slot.endsAt, data.timezone) === date
        ? minuteInZone(slot.endsAt.toISOString(), data.timezone)
        : 1440;
    const previous = ranges[ranges.length - 1];
    if (previous && startMinute <= previous.endMinute)
      previous.endMinute = Math.max(previous.endMinute, endMinute);
    else ranges.push({ startMinute, endMinute });
  }
  return ranges;
}

export const minuteLabel = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
