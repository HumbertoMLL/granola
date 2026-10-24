"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Globe } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  cn,
} from "@granola/ui";
import {
  addDaysYmd,
  formatTimeInTz,
  formatYmdLong,
  groupSlotsByDay,
  parseYmd,
  timeZoneLabel,
  weekdayOfYmd,
  ymdInTz,
  type Slot,
} from "@granola/core/scheduling";

import { LATAM_TIMEZONES } from "@/components/agenda/timezones";

export type SlotIso = { startsAt: string; endsAt: string };

type Props = {
  slots: SlotIso[] | null; // null = cargando
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  selected: string | null; // startsAt ISO
  onSelect: (slot: SlotIso) => void;
  nowIso: string;
};

const DOW = ["L", "M", "M", "J", "V", "S", "D"];

/** Zona del navegador, o null en SSR. */
export function detectTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

export function SlotPicker({ slots, timezone, onTimezoneChange, selected, onSelect, nowIso }: Props) {
  const parsed = React.useMemo<Slot[] | null>(
    () => slots?.map((s) => ({ startsAt: new Date(s.startsAt), endsAt: new Date(s.endsAt) })) ?? null,
    [slots],
  );
  const days = React.useMemo(() => (parsed ? groupSlotsByDay(parsed, timezone) : []), [parsed, timezone]);
  const available = React.useMemo(() => new Map(days.map((d) => [d.date, d.slots])), [days]);

  const today = ymdInTz(new Date(nowIso), timezone);
  const [pickedDay, setPickedDay] = React.useState<string | null>(null);
  const [pickedMonth, setPickedMonth] = React.useState<string | null>(null);

  // Día efectivo: el que tocó el usuario; si no, el del slot ya elegido (reagendar);
  // si no, el primer día con disponibilidad. Derivado, sin efectos.
  const selectedDay =
    pickedDay ?? (selected ? ymdInTz(new Date(selected), timezone) : null) ?? days[0]?.date ?? null;
  const monthStart = pickedMonth ?? `${(selectedDay ?? today).slice(0, 7)}-01`;
  const setSelectedDay = (d: string) => {
    setPickedDay(d);
    setPickedMonth(null);
  };
  const setMonthStart = (m: string) => setPickedMonth(m);

  const { year, month } = parseYmd(monthStart);
  const monthLabel = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  const firstWeekday = (weekdayOfYmd(monthStart) + 6) % 7; // lunes = 0
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDaysYmd(monthStart, i)),
  ];
  const lastAvailable = days[days.length - 1]?.date ?? today;
  const canPrev = monthStart > today.slice(0, 7) + "-01";
  const canNext = monthStart.slice(0, 7) < lastAvailable.slice(0, 7);

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    setMonthStart(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
  }

  const daySlots = selectedDay ? available.get(selectedDay) ?? [] : [];
  const tzKnown = LATAM_TIMEZONES.some((t) => t.value === timezone);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
            onClick={() => shiftMonth(-1)}
            disabled={!canPrev}
            aria-label="Mes anterior"
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="font-semibold capitalize">{monthLabel}</p>
          <button
            type="button"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
            onClick={() => shiftMonth(1)}
            disabled={!canNext}
            aria-label="Mes siguiente"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted-foreground">
          {DOW.map((d, i) => (
            <span key={i} className="py-1">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((ymd, i) => {
            if (!ymd) return <span key={`e${i}`} />;
            const has = available.has(ymd);
            const isSel = ymd === selectedDay;
            const isToday = ymd === today;
            return (
              <button
                key={ymd}
                type="button"
                disabled={!has || slots === null}
                onClick={() => setSelectedDay(ymd)}
                className={cn(
                  "relative mx-auto flex size-10 items-center justify-center rounded-full text-sm tabular-nums transition-colors",
                  has ? "font-semibold text-foreground hover:bg-primary-soft" : "text-muted-foreground/50",
                  isSel && "bg-primary text-primary-foreground hover:bg-primary",
                  isToday && !isSel && "ring-1 ring-border",
                )}
              >
                {parseYmd(ymd).day}
                {has && !isSel ? (
                  <span className="absolute bottom-1 size-1 rounded-full bg-primary" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
        {slots === null ? (
          <div className="mt-3 grid grid-cols-7 gap-1">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="mx-auto size-10 rounded-full" />
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe className="size-4 shrink-0" />
        <span className="shrink-0">Horarios en</span>
        <Select value={timezone} onValueChange={onTimezoneChange}>
          <SelectTrigger className="h-9 flex-1 rounded-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {!tzKnown ? (
              <SelectItem value={timezone}>
                {timezone.replace(/_/g, " ")} ({timeZoneLabel(timezone)})
              </SelectItem>
            ) : null}
            {LATAM_TIMEZONES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label} ({timeZoneLabel(t.value)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3">
        {selectedDay ? (
          <p className="text-sm font-semibold capitalize">{formatYmdLong(selectedDay)}</p>
        ) : slots && slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay horarios disponibles en las próximas semanas. Escríbele directamente para coordinar.
          </p>
        ) : null}
        {daySlots.length > 0 ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {daySlots.map((s) => {
              const iso = s.startsAt.toISOString();
              const isSel = iso === selected;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onSelect({ startsAt: iso, endsAt: s.endsAt.toISOString() })}
                  className={cn(
                    "h-11 rounded-xl border text-sm font-semibold tabular-nums transition-colors",
                    isSel
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:border-primary hover:text-primary",
                  )}
                >
                  {formatTimeInTz(s.startsAt, timezone)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const noopSubscribe = () => () => {};

/**
 * Zona del navegador sin romper la hidratación: en servidor devuelve `fallback`,
 * en cliente la real. Sin setState en efectos.
 */
export function useDetectedTimezone(fallback: string): string {
  return React.useSyncExternalStore(noopSubscribe, () => detectTimezone() ?? fallback, () => fallback);
}
