"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  EmptyState,
  Button,
  cn,
} from "@granola/ui";
import {
  addDaysYmd,
  formatTimeInTz,
  formatYmdLong,
  groupSlotsByDay,
  parseYmd,
  weekdayOfYmd,
  ymdInTz,
  type Slot,
} from "@granola/core/scheduling";

import { LATAM_TIMEZONES } from "@/components/agenda/timezones";
import { formatCalendarDate, formatTimezone } from "./format";

export type SlotIso = { startsAt: string; endsAt: string };

type Props = {
  slots: SlotIso[] | null; // null = cargando
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  selected: string | null; // startsAt ISO
  onSelect: (slot: SlotIso) => void;
  nowIso: string;
  mode?: "date" | "time" | "both";
  selectedDate?: string | null;
  onDateSelect?: (date: string) => void;
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

export function SlotPicker({
  slots,
  timezone,
  onTimezoneChange,
  selected,
  onSelect,
  nowIso,
  mode = "both",
  selectedDate,
  onDateSelect,
}: Props) {
  const parsed = React.useMemo<Slot[] | null>(
    () =>
      slots?.map((s) => ({
        startsAt: new Date(s.startsAt),
        endsAt: new Date(s.endsAt),
      })) ?? null,
    [slots],
  );
  const days = React.useMemo(
    () => (parsed ? groupSlotsByDay(parsed, timezone) : []),
    [parsed, timezone],
  );
  const available = React.useMemo(
    () => new Map(days.map((d) => [d.date, d.slots])),
    [days],
  );

  const today = ymdInTz(new Date(nowIso), timezone);
  const [pickedDay, setPickedDay] = React.useState<string | null>(null);
  const [pickedMonth, setPickedMonth] = React.useState<string | null>(null);

  // Día efectivo: el que tocó el usuario; si no, el del slot ya elegido (reagendar);
  // si no, el primer día con disponibilidad. Derivado, sin efectos.
  const selectedDay =
    selectedDate ??
    pickedDay ??
    (selected ? ymdInTz(new Date(selected), timezone) : null) ??
    days[0]?.date ??
    null;
  const monthStart = pickedMonth ?? `${(selectedDay ?? today).slice(0, 7)}-01`;
  const setSelectedDay = (d: string) => {
    setPickedDay(d);
    onDateSelect?.(d);
    setPickedMonth(null);
  };
  const setMonthStart = (m: string) => setPickedMonth(m);

  const { year, month } = parseYmd(monthStart);
  const monthLabel = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: year === Number(today.slice(0, 4)) ? undefined : "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
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
    setMonthStart(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`,
    );
  }

  const daySlots = selectedDay ? (available.get(selectedDay) ?? []) : [];
  const tzKnown = LATAM_TIMEZONES.some((t) => t.value === timezone);

  return (
    <div className="flex flex-col gap-6">
      {mode !== "time" && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
              onClick={() => shiftMonth(-1)}
              disabled={!canPrev}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="font-semibold capitalize">{monthLabel}</p>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-30"
              onClick={() => shiftMonth(1)}
              disabled={!canNext}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="size-4" />
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
              const isSel =
                ymd === selectedDay &&
                (mode !== "date" || !!selectedDate || !!pickedDay);
              const isToday = ymd === today;
              return (
                <button
                  key={ymd}
                  type="button"
                  aria-label={formatYmdLong(ymd)}
                  aria-pressed={isSel}
                  disabled={!has || slots === null}
                  onClick={() => setSelectedDay(ymd)}
                  className={cn(
                    "relative mx-auto flex size-11 items-center justify-center rounded-md text-base tabular-nums transition-colors duration-150",
                    has
                      ? "font-semibold text-foreground hover:bg-primary-soft"
                      : "text-foreground/35",
                    isSel &&
                      "bg-primary text-primary-foreground hover:bg-primary",
                    isToday && !isSel && "ring-1 ring-border",
                  )}
                >
                  {parseYmd(ymd).day}
                  {has && !isSel ? (
                    <span
                      className="absolute bottom-1 size-1 rounded-md bg-current"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
          {slots === null ? (
            <div className="mt-3 grid grid-cols-7 gap-1">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={i} className="mx-auto size-11 rounded-md" />
              ))}
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3 text-sm text-muted-foreground">
        <span>Zona horaria</span>
        <Select value={timezone} onValueChange={onTimezoneChange}>
          <SelectTrigger
            aria-label="Zona horaria"
            className="h-11 min-w-0 max-w-full flex-1 border-0 bg-transparent px-0 text-sm font-normal shadow-none [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {!tzKnown ? (
              <SelectItem value={timezone}>
                {formatTimezone(timezone)}
              </SelectItem>
            ) : null}
            {LATAM_TIMEZONES.map((zone) => (
              <SelectItem key={zone.value} value={zone.value}>
                {formatTimezone(zone.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mode !== "date" && (
        <div className="flex flex-col gap-3">
          {selectedDay && (
            <p className="text-sm font-semibold">
              {formatCalendarDate(selectedDay)}
            </p>
          )}
          {slots === null && (
            <div
              role="status"
              aria-label="Cargando horarios"
              className="grid grid-cols-3 gap-2"
            >
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          )}
          {daySlots.length > 0 && (
            <fieldset className="flex flex-col gap-4">
              <legend className="sr-only">Hora de tu consulta</legend>
              {[
                { label: "Mañana", morning: true },
                { label: "Tarde", morning: false },
              ].map((group) => {
                const groupSlots = daySlots.filter((s) => {
                  const hour = Number(
                    new Intl.DateTimeFormat("en", {
                      timeZone: timezone,
                      hour: "numeric",
                      hourCycle: "h23",
                    }).format(s.startsAt),
                  );
                  return group.morning ? hour < 12 : hour >= 12;
                });
                if (!groupSlots.length) return null;
                return (
                  <div key={group.label}>
                    <h2 className="mb-2 text-sm font-semibold">
                      {group.label}
                    </h2>
                    <div className="grid grid-cols-3 gap-2">
                      {groupSlots.map((s) => {
                        const iso = s.startsAt.toISOString();
                        return (
                          <label key={iso} className="cursor-pointer">
                            <input
                              type="radio"
                              name="slot"
                              value={iso}
                              checked={iso === selected}
                              className="peer sr-only"
                              onChange={() =>
                                onSelect({
                                  startsAt: iso,
                                  endsAt: s.endsAt.toISOString(),
                                })
                              }
                            />
                            <span className="flex h-11 items-center justify-center rounded-md border border-border bg-card text-base font-medium tabular-nums transition-colors duration-150 hover:border-primary peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-ring">
                              {formatTimeInTz(s.startsAt, timezone)}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </fieldset>
          )}
          {slots && !daySlots.length && slots.length > 0 && (
            <p role="status" className="text-sm text-muted-foreground">
              Este día no tiene horarios. Elige otra fecha.
            </p>
          )}
        </div>
      )}
      {slots?.length === 0 && (
        <EmptyState
          title="No hay horarios disponibles"
          description="Escríbele a tu nutrióloga para coordinar o vuelve a revisar más tarde."
          action={
            <Button variant="outline" asChild>
              <a href="../">Volver al perfil</a>
            </Button>
          }
        />
      )}
    </div>
  );
}

const noopSubscribe = () => () => {};

/**
 * Zona del navegador sin romper la hidratación: en servidor devuelve `fallback`,
 * en cliente la real. Sin setState en efectos.
 */
export function useDetectedTimezone(fallback: string): string {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => detectTimezone() ?? fallback,
    () => fallback,
  );
}
