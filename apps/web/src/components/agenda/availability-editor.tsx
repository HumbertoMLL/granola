"use client";

import * as React from "react";
import { CalendarOff, CalendarPlus, Plus, Trash2, X } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast,
} from "@granola/ui";
import { formatYmdLong, parseTimeToMinutes } from "@granola/core/scheduling";

import {
  addAvailabilityOverride,
  deleteAvailabilityOverride,
  saveAvailabilityRules,
  updateTimezone,
} from "@/app/(panel)/app/agenda/actions";
import { Field } from "@/components/agenda/services-manager";
import { LATAM_TIMEZONES, WEEKDAY_NAMES } from "@/components/agenda/timezones";

export type RuleRow = { id: string; weekday: number; startTime: string; endTime: string };
export type OverrideRow = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isBlocked: boolean;
};

type Window = { key: string; startTime: string; endTime: string };

/** "09:00:00" (Postgres time) → "09:00" para <input type="time">. */
const hm = (t: string) => t.slice(0, 5);

let keySeq = 0;
const nextKey = () => `w${++keySeq}`;

// Lunes primero, como en México.
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function AvailabilityEditor({
  rules,
  overrides,
  timezone,
}: {
  rules: RuleRow[];
  overrides: OverrideRow[];
  timezone: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <TimezoneCard timezone={timezone} />
      <WeeklyEditor rules={rules} />
      <OverridesEditor overrides={overrides} />
    </div>
  );
}

function TimezoneCard({ timezone }: { timezone: string }) {
  const [pending, startTransition] = React.useTransition();
  const known = LATAM_TIMEZONES.some((t) => t.value === timezone);
  return (
    <Card className="gap-3 p-4">
      <div>
        <p className="font-semibold">Zona horaria</p>
        <p className="text-sm text-muted-foreground">
          Tus horarios se interpretan en esta zona. A cada paciente le mostramos la hora en la suya.
        </p>
      </div>
      <Select
        value={timezone}
        disabled={pending}
        onValueChange={(v) =>
          startTransition(async () => {
            const res = await updateTimezone(v);
            if (res.ok) toast.success("Zona horaria actualizada");
            else toast.error(res.error);
          })
        }
      >
        <SelectTrigger className="sm:max-w-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {!known ? <SelectItem value={timezone}>{timezone}</SelectItem> : null}
          {LATAM_TIMEZONES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Card>
  );
}

function WeeklyEditor({ rules }: { rules: RuleRow[] }) {
  const initial = React.useMemo(() => {
    const byDay: Record<number, Window[]> = {};
    for (const d of WEEKDAY_ORDER) byDay[d] = [];
    for (const r of rules) byDay[r.weekday]?.push({ key: r.id, startTime: hm(r.startTime), endTime: hm(r.endTime) });
    return byDay;
  }, [rules]);

  const [localDays, setLocalDays] = React.useState<Record<number, Window[]>>(initial);
  const [dirty, setDirty] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  // Sin cambios locales mostramos lo del servidor (se actualiza solo tras revalidar).
  const days = dirty ? localDays : initial;

  function update(fn: (d: Record<number, Window[]>) => Record<number, Window[]>) {
    setLocalDays(fn(structuredClone(days)));
    setDirty(true);
  }

  function addWindow(weekday: number) {
    update((d) => {
      const list = d[weekday] ?? [];
      const last = list[list.length - 1];
      const start = last ? last.endTime : "09:00";
      const startMin = Math.min(parseTimeToMinutes(start), 22 * 60);
      const endMin = Math.min(startMin + 4 * 60, 23 * 60 + 30);
      const pad = (n: number) => String(n).padStart(2, "0");
      const toHm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
      list.push({ key: nextKey(), startTime: toHm(startMin), endTime: toHm(endMin) });
      d[weekday] = list;
      return d;
    });
  }

  function copyToWeekdays(from: number) {
    update((d) => {
      const src = (d[from] ?? []).map((w) => ({ ...w }));
      for (const wd of [1, 2, 3, 4, 5]) {
        if (wd === from) continue;
        d[wd] = src.map((w) => ({ ...w, key: nextKey() }));
      }
      return d;
    });
  }

  const validation = React.useMemo(() => {
    for (const wd of WEEKDAY_ORDER) {
      const list = days[wd] ?? [];
      for (const w of list) {
        if (!w.startTime || !w.endTime) return "Completa todas las horas";
        if (parseTimeToMinutes(w.endTime) <= parseTimeToMinutes(w.startTime))
          return `${WEEKDAY_NAMES[wd]}: la hora de fin debe ser mayor que la de inicio`;
      }
      const sorted = [...list].sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
      for (let i = 1; i < sorted.length; i++) {
        if (parseTimeToMinutes(sorted[i]!.startTime) < parseTimeToMinutes(sorted[i - 1]!.endTime))
          return `${WEEKDAY_NAMES[wd]}: hay ventanas encimadas`;
      }
    }
    return null;
  }, [days]);

  function save() {
    if (validation) {
      toast.error(validation);
      return;
    }
    const payload = WEEKDAY_ORDER.flatMap((wd) =>
      (days[wd] ?? []).map((w) => ({ weekday: wd, startTime: w.startTime, endTime: w.endTime })),
    );
    startTransition(async () => {
      const res = await saveAvailabilityRules(payload);
      if (res.ok) {
        toast.success("Horario guardado");
        setDirty(false);
      } else toast.error(res.error);
    });
  }

  return (
    <Card className="gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Horario semanal</p>
          <p className="text-sm text-muted-foreground">Puedes tener varias ventanas por día (p. ej. mañana y tarde).</p>
        </div>
        {dirty ? <Badge variant="accent">Sin guardar</Badge> : null}
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {WEEKDAY_ORDER.map((wd) => {
          const list = days[wd] ?? [];
          const enabled = list.length > 0;
          return (
            <li key={wd} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start">
              <div className="flex w-full items-center justify-between sm:w-36 sm:shrink-0 sm:pt-2.5">
                <Label htmlFor={`day-${wd}`} className="text-sm font-semibold">
                  {WEEKDAY_NAMES[wd]}
                </Label>
                <Switch
                  id={`day-${wd}`}
                  checked={enabled}
                  onCheckedChange={(v) => {
                    if (v) addWindow(wd);
                    else update((d) => ({ ...d, [wd]: [] }));
                  }}
                />
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {!enabled ? (
                  <p className="text-sm text-muted-foreground sm:pt-2.5">No atiendes</p>
                ) : (
                  list.map((w, i) => (
                    <div key={w.key} className="flex items-center gap-2">
                      <Input
                        type="time"
                        step={900}
                        value={w.startTime}
                        className="w-auto flex-1 tabular-nums sm:max-w-32"
                        onChange={(e) =>
                          update((d) => {
                            d[wd]![i]!.startTime = e.target.value;
                            return d;
                          })
                        }
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        step={900}
                        value={w.endTime}
                        className="w-auto flex-1 tabular-nums sm:max-w-32"
                        onChange={(e) =>
                          update((d) => {
                            d[wd]![i]!.endTime = e.target.value;
                            return d;
                          })
                        }
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Quitar ventana"
                        onClick={() =>
                          update((d) => {
                            d[wd] = (d[wd] ?? []).filter((_, j) => j !== i);
                            return d;
                          })
                        }
                      >
                        <X />
                      </Button>
                    </div>
                  ))
                )}
                {enabled ? (
                  <div className="flex flex-wrap gap-1">
                    <Button type="button" size="sm" variant="ghost" onClick={() => addWindow(wd)}>
                      <Plus /> Otra ventana
                    </Button>
                    {wd >= 1 && wd <= 5 ? (
                      <Button type="button" size="sm" variant="ghost" onClick={() => copyToWeekdays(wd)}>
                        Copiar a lun–vie
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {validation && dirty ? <p className="text-sm text-destructive">{validation}</p> : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || pending}
          onClick={() => {
            setLocalDays(initial);
            setDirty(false);
          }}
        >
          Descartar
        </Button>
        <Button type="button" onClick={save} loading={pending} disabled={!dirty}>
          Guardar horario
        </Button>
      </div>
    </Card>
  );
}

function OverridesEditor({ overrides }: { overrides: OverrideRow[] }) {
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [date, setDate] = React.useState("");
  const [fullDay, setFullDay] = React.useState(true);
  const [mode, setMode] = React.useState<"block" | "extra">("block");
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("13:00");

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [...overrides].filter((o) => o.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));

  function add() {
    if (!date) {
      toast.error("Elige una fecha");
      return;
    }
    const withHours = mode === "extra" || !fullDay;
    startTransition(async () => {
      const res = await addAvailabilityOverride({
        date,
        startTime: withHours ? startTime : null,
        endTime: withHours ? endTime : null,
        isBlocked: mode === "block",
      });
      if (res.ok) {
        toast.success(mode === "block" ? "Fecha bloqueada" : "Ventana extra agregada");
        setOpen(false);
        setDate("");
      } else toast.error(res.error);
    });
  }

  return (
    <Card className="gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Excepciones</p>
          <p className="text-sm text-muted-foreground">Vacaciones, días festivos o un sábado que sí vas a atender.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          <Plus /> Agregar
        </Button>
      </div>

      {open ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha">
              <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Tipo">
              <Select value={mode} onValueChange={(v) => setMode(v as "block" | "extra")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">Bloquear (no atiendo)</SelectItem>
                  <SelectItem value="extra">Ventana extra (sí atiendo)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {mode === "block" ? (
            <div className="flex items-center justify-between">
              <Label htmlFor="full-day">Todo el día</Label>
              <Switch id="full-day" checked={fullDay} onCheckedChange={setFullDay} />
            </div>
          ) : null}
          {mode === "extra" || !fullDay ? (
            <div className="flex items-center gap-2">
              <Input type="time" step={900} value={startTime} onChange={(e) => setStartTime(e.target.value)} className="tabular-nums" />
              <span className="text-muted-foreground">–</span>
              <Input type="time" step={900} value={endTime} onChange={(e) => setEndTime(e.target.value)} className="tabular-nums" />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button onClick={add} loading={pending}>
              Guardar excepción
            </Button>
          </div>
        </div>
      ) : null}

      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">No tienes excepciones próximas.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {upcoming.map((o) => (
            <li key={o.id} className="flex items-center gap-3 py-2.5">
              {o.isBlocked ? (
                <CalendarOff className="size-4 shrink-0 text-destructive" />
              ) : (
                <CalendarPlus className="size-4 shrink-0 text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize">{formatYmdLong(o.date, "es-MX", { year: "numeric" })}</p>
                <p className="text-xs text-muted-foreground">
                  {o.isBlocked ? "Bloqueado" : "Ventana extra"}
                  {o.startTime && o.endTime ? ` · ${hm(o.startTime)}–${hm(o.endTime)}` : " · todo el día"}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Eliminar excepción"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteAvailabilityOverride(o.id);
                    if (!res.ok) toast.error(res.error);
                  })
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
