"use client";

import * as React from "react";
import { CalendarOff, CalendarPlus, Plus, Trash2, X } from "lucide-react";

import {
  Badge,
  EmptyState,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
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
import { parseTimeToMinutes } from "@granola/core/scheduling";

import {
  addAvailabilityOverride,
  deleteAvailabilityOverride,
  saveAvailabilityRules,
  updateSchedulingSettings,
  updateTimezone,
} from "@/app/(panel)/app/agenda/actions";
import { formatCalendarDate } from "@/components/booking/format";
import { Field } from "@/components/agenda/services-manager";
import { LATAM_TIMEZONES, WEEKDAY_NAMES } from "@/components/agenda/timezones";

export type RuleRow = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
};
export type OverrideRow = {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isBlocked: boolean;
};

export type SchedulingSettingsRow = {
  bufferMin: number;
  minNoticeMin: number;
  slotStepMin: number;
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
  scheduling,
}: {
  rules: RuleRow[];
  overrides: OverrideRow[];
  timezone: string;
  scheduling: SchedulingSettingsRow;
}) {
  return (
    <div className="flex flex-col gap-6">
      <TimezoneCard timezone={timezone} />
      <SchedulingSettingsCard
        key={`${scheduling.bufferMin}-${scheduling.minNoticeMin}-${scheduling.slotStepMin}`}
        initial={scheduling}
      />
      <WeeklyEditor rules={rules} />
      <OverridesEditor overrides={overrides} />
    </div>
  );
}

function TimezoneCard({ timezone }: { timezone: string }) {
  const [pending, startTransition] = React.useTransition();
  const known = LATAM_TIMEZONES.some((t) => t.value === timezone);
  return (
    <section className="flex flex-col gap-3 border-b border-border pb-6">
      <div>
        <p className="font-semibold">Zona horaria</p>
        <p className="text-sm text-muted-foreground">
          Tus horarios se interpretan en esta zona. A cada paciente le mostramos
          la hora en la suya.
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
        <SelectTrigger aria-label="Zona horaria" className="sm:max-w-sm">
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
    </section>
  );
}

type Option = { value: number; label: string };

const BUFFER_OPTIONS: Option[] = [
  { value: 0, label: "Sin margen" },
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 20, label: "20 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hora" },
];

const NOTICE_OPTIONS: Option[] = [
  { value: 0, label: "Sin mínimo" },
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hora" },
  { value: 120, label: "2 horas" },
  { value: 240, label: "4 horas" },
  { value: 720, label: "12 horas" },
  { value: 1440, label: "1 día" },
  { value: 2880, label: "2 días" },
];

const STEP_OPTIONS: Option[] = [
  { value: 10, label: "Cada 10 min" },
  { value: 15, label: "Cada 15 min" },
  { value: 20, label: "Cada 20 min" },
  { value: 30, label: "Cada 30 min" },
  { value: 45, label: "Cada 45 min" },
  { value: 60, label: "Cada hora" },
];

/** Si el valor guardado no está en la lista (p. ej. puesto por soporte), se agrega. */
function withCurrent(options: Option[], value: number): Option[] {
  return options.some((o) => o.value === value)
    ? options
    : [...options, { value, label: `${value} min` }];
}

function SchedulingSettingsCard({
  initial,
}: {
  initial: SchedulingSettingsRow;
}) {
  const [values, setValues] = React.useState<SchedulingSettingsRow>(initial);
  const [pending, startTransition] = React.useTransition();
  const dirty =
    values.bufferMin !== initial.bufferMin ||
    values.minNoticeMin !== initial.minNoticeMin ||
    values.slotStepMin !== initial.slotStepMin;

  function save() {
    startTransition(async () => {
      const res = await updateSchedulingSettings(values);
      if (res.ok) toast.success("Reglas de agenda guardadas");
      else toast.error(res.error);
    });
  }

  const fields: {
    key: keyof SchedulingSettingsRow;
    label: string;
    hint: string;
    options: Option[];
  }[] = [
    {
      key: "minNoticeMin",
      label: "Antelación mínima",
      hint: "Nadie puede agendar con menos tiempo que esto.",
      options: NOTICE_OPTIONS,
    },
    {
      key: "bufferMin",
      label: "Margen entre citas",
      hint: "Tiempo libre después de cada consulta.",
      options: BUFFER_OPTIONS,
    },
    {
      key: "slotStepMin",
      label: "Horarios de inicio",
      hint: "Cada cuánto se ofrece un horario al paciente.",
      options: STEP_OPTIONS,
    },
  ];

  return (
    <section className="flex flex-col gap-4 border-b border-border py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Reglas de agenda</p>
        </div>
        {dirty ? <Badge variant="accent">Sin guardar</Badge> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <Select
              value={String(values[f.key])}
              disabled={pending}
              onValueChange={(v) =>
                setValues((cur) => ({ ...cur, [f.key]: Number(v) }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {withCurrent(f.options, values[f.key]).map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!dirty || pending}
          onClick={() => setValues(initial)}
        >
          Descartar
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={save}
          loading={pending}
          disabled={!dirty}
        >
          Guardar reglas
        </Button>
      </div>
    </section>
  );
}

function WeeklyEditor({ rules }: { rules: RuleRow[] }) {
  const initial = React.useMemo(() => {
    const byDay: Record<number, Window[]> = {};
    for (const d of WEEKDAY_ORDER) byDay[d] = [];
    for (const r of rules)
      byDay[r.weekday]?.push({
        key: r.id,
        startTime: hm(r.startTime),
        endTime: hm(r.endTime),
      });
    return byDay;
  }, [rules]);

  const [localDays, setLocalDays] =
    React.useState<Record<number, Window[]>>(initial);
  const [dirty, setDirty] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  // Sin cambios locales mostramos lo del servidor (se actualiza solo tras revalidar).
  const days = dirty ? localDays : initial;

  function update(
    fn: (d: Record<number, Window[]>) => Record<number, Window[]>,
  ) {
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
      list.push({
        key: nextKey(),
        startTime: toHm(startMin),
        endTime: toHm(endMin),
      });
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
      const sorted = [...list].sort(
        (a, b) =>
          parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime),
      );
      for (let i = 1; i < sorted.length; i++) {
        if (
          parseTimeToMinutes(sorted[i]!.startTime) <
          parseTimeToMinutes(sorted[i - 1]!.endTime)
        )
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
      (days[wd] ?? []).map((w) => ({
        weekday: wd,
        startTime: w.startTime,
        endTime: w.endTime,
      })),
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
    <section className="flex flex-col gap-4 border-b border-border py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Horario semanal</p>
        </div>
        {dirty ? <Badge variant="accent">Sin guardar</Badge> : null}
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {WEEKDAY_ORDER.map((wd) => {
          const list = days[wd] ?? [];
          const enabled = list.length > 0;
          return (
            <li
              key={wd}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start"
            >
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
                  <p className="text-sm text-muted-foreground sm:pt-2.5">
                    No atiendes
                  </p>
                ) : (
                  list.map((w, i) => (
                    <div key={w.key} className="flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`start-${w.key}`}>Desde</Label>
                        <Input
                          type="time"
                          step={900}
                          id={`start-${w.key}`}
                          value={w.startTime}
                          className="w-auto flex-1 tabular-nums sm:max-w-32"
                          onChange={(e) =>
                            update((d) => {
                              d[wd]![i]!.startTime = e.target.value;
                              return d;
                            })
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <Label htmlFor={`end-${w.key}`}>Hasta</Label>
                        <Input
                          type="time"
                          step={900}
                          id={`end-${w.key}`}
                          value={w.endTime}
                          className="w-auto flex-1 tabular-nums sm:max-w-32"
                          onChange={(e) =>
                            update((d) => {
                              d[wd]![i]!.endTime = e.target.value;
                              return d;
                            })
                          }
                        />
                      </div>
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
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => addWindow(wd)}
                    >
                      <Plus /> Otra ventana
                    </Button>
                    {wd >= 1 && wd <= 5 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToWeekdays(wd)}
                      >
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

      {validation && dirty ? (
        <p className="text-sm text-destructive-ink">{validation}</p>
      ) : null}

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
        <Button
          type="button"
          onClick={save}
          loading={pending}
          disabled={!dirty}
        >
          Guardar horario
        </Button>
      </div>
    </section>
  );
}

function OverridesEditor({ overrides }: { overrides: OverrideRow[] }) {
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const [date, setDate] = React.useState("");
  const [fullDay, setFullDay] = React.useState(true);
  const [mode, setMode] = React.useState<"block" | "extra">("block");
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("13:00");

  const today = new Date().toLocaleDateString("en-CA");
  const upcoming = [...overrides]
    .filter((o) => o.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

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
        toast.success(
          mode === "block" ? "Fecha bloqueada" : "Ventana extra agregada",
        );
        setOpen(false);
        setDate("");
      } else toast.error(res.error);
    });
  }

  return (
    <section className="flex flex-col gap-4 border-b border-border py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Excepciones</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
          <Plus /> Agregar
        </Button>
      </div>

      {open ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha">
              <Input
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Tipo">
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as "block" | "extra")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="block">Bloquear (no atiendo)</SelectItem>
                  <SelectItem value="extra">
                    Ventana extra (sí atiendo)
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {mode === "block" ? (
            <div className="flex items-center justify-between">
              <Label htmlFor="full-day">Todo el día</Label>
              <Switch
                id="full-day"
                checked={fullDay}
                onCheckedChange={setFullDay}
              />
            </div>
          ) : null}
          {mode === "extra" || !fullDay ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="override-start">Desde</Label>
                <Input
                  id="override-start"
                  type="time"
                  step={900}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="override-end">Hasta</Label>
                <Input
                  id="override-end"
                  type="time"
                  step={900}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="tabular-nums"
                />
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button variant="outline" onClick={add} loading={pending}>
              Guardar excepción
            </Button>
          </div>
        </div>
      ) : null}

      {upcoming.length === 0 ? (
        <EmptyState
          title="Sin excepciones próximas"
          description="Agrega vacaciones, días festivos o ventanas extra."
          action={
            <Button variant="outline" onClick={() => setOpen(true)}>
              Agregar excepción
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {upcoming.map((o) => (
            <li key={o.id} className="flex items-center gap-3 py-3">
              {o.isBlocked ? (
                <CalendarOff className="size-4 shrink-0 text-destructive-ink" />
              ) : (
                <CalendarPlus className="size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium capitalize">
                  {formatCalendarDate(o.date)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {o.isBlocked ? "Bloqueado" : "Ventana extra"}
                  {o.startTime && o.endTime
                    ? ` · ${hm(o.startTime)}–${hm(o.endTime)}`
                    : " · todo el día"}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Eliminar excepción"
                disabled={pending}
                onClick={() => setDeleting(o.id)}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar esta excepción?</DialogTitle>
            <DialogDescription>
              Se volverá a aplicar tu horario semanal para esa fecha.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() => {
                if (!deleting) return;
                startTransition(async () => {
                  const res = await deleteAvailabilityOverride(deleting);
                  if (res.ok) setDeleting(null);
                  else toast.error(res.error);
                });
              }}
            >
              Sí, eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
