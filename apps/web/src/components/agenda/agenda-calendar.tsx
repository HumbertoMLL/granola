"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  addDaysYmd,
  formatTimeInTz,
  formatYmdLong,
  weekdayOfYmd,
  ymdInTz,
  zonedTimeToUtc,
  parseTimeToMinutes,
} from "@granola/core/scheduling";
import {
  AppliedFilters,
  Badge,
  Button,
  EmptyState,
  FilterChip,
  Input,
  Label,
  SegmentedControl,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Timeline,
  cn,
  toast,
  type TimelineRange,
} from "@granola/ui";
import { addAvailabilityOverride } from "@/app/(panel)/app/agenda/actions";
import { AppointmentActions } from "@/app/(panel)/app/agenda/[appointmentId]/appointment-actions";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
} from "@/components/booking/format";
import type { AgendaData } from "./agenda-tabs";
import { freeRangesForDay, minuteInZone, minuteLabel } from "./calendar-layout";

const FILTERS = [
  { id: "today", label: "Hoy" },
  { id: "week", label: "Semana" },
  { id: "pending", label: "Pendientes de pago" },
  { id: "online", label: "Online" },
  { id: "presencial", label: "Presencial" },
];

export function AgendaCalendar({ data }: { data: AgendaData }) {
  const [nowIso, setNowIso] = React.useState(data.nowIso);
  React.useEffect(() => {
    const timer = window.setInterval(
      () => setNowIso(new Date().toISOString()),
      60_000,
    );
    return () => window.clearInterval(timer);
  }, []);
  const today = ymdInTz(new Date(nowIso), data.timezone);
  const [date, setDate] = React.useState(() =>
    ymdInTz(new Date(data.nowIso), data.timezone),
  );
  const [view, setView] = React.useState("day");
  const [filters, setFilters] = React.useState<string[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [gap, setGap] = React.useState<
    (TimelineRange & { date: string; kind?: string }) | null
  >(null);
  const monday = addDaysYmd(date, -((weekdayOfYmd(date) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDaysYmd(monday, i));
  const matches = data.appointments.filter((a) => {
    const day = ymdInTz(new Date(a.startsAt), data.timezone);
    return (
      a.status !== "cancelled" &&
      (view === "day" ? day === date : days.includes(day)) &&
      (!filters.includes("today") || day === today) &&
      (!filters.includes("pending") || a.status === "pending_payment") &&
      (!(filters.includes("online") || filters.includes("presencial")) ||
        filters.includes(a.modality))
    );
  });
  const selected = data.appointments.find((a) => a.id === selectedId);
  const selectedActive =
    selected?.status === "confirmed" || selected?.status === "pending_payment";
  const freeByDay = React.useMemo(() => {
    const first = addDaysYmd(date, -((weekdayOfYmd(date) + 6) % 7));
    return new Map(
      Array.from({ length: 7 }, (_, i) => {
        const day = addDaysYmd(first, i);
        return [day, freeRangesForDay(data, day, new Date(nowIso))] as const;
      }),
    );
  }, [data, date, nowIso]);
  const free = (day: string) => freeByDay.get(day) ?? [];
  const dayRows = (day: string) =>
    matches.filter((a) => ymdInTz(new Date(a.startsAt), data.timezone) === day);
  const dayBlocks = (day: string) =>
    dayRows(day).map((a) => ({
      id: a.id,
      startMinute: minuteInZone(a.startsAt, data.timezone),
      endMinute:
        ymdInTz(new Date(a.endsAt), data.timezone) === day
          ? minuteInZone(a.endsAt, data.timezone)
          : 1440,
      label: `${a.patientName}, ${a.serviceName}, ${formatTimeInTz(new Date(a.startsAt), data.timezone)}, ${STATUS_LABEL[a.status]}`,
      className: cn(
        a.status === "pending_payment" &&
          "border border-dashed border-primary border-l-4",
        (a.status === "completed" || a.status === "no_show") &&
          "border-muted-foreground bg-muted text-muted-foreground",
      ),
      content: (
        <>
          <span className="flex items-center justify-between gap-1">
            <span
              className={cn(
                "truncate font-semibold",
                a.status === "completed" && "line-through",
              )}
            >
              {a.patientName}
            </span>
            <Badge
              variant={STATUS_BADGE_VARIANT[a.status]}
              className="shrink-0 px-1 text-[10px]"
            >
              {STATUS_LABEL[a.status]}
            </Badge>
          </span>
          <span className="block truncate text-xs">
            {a.serviceName} ·{" "}
            {a.modality === "online" ? "Online" : "Presencial"}
          </span>
        </>
      ),
    }));
  // Incluir citas fuera de 9–19 h sin recortarlas. Ambas vistas comparten escala horaria.
  const allBlocks = days.flatMap(dayBlocks);
  const allFree = days.flatMap(free);
  const startMinute =
    Math.floor(
      Math.min(
        540,
        ...allBlocks.map((a) => a.startMinute),
        ...allFree.map((a) => a.startMinute),
      ) / 60,
    ) * 60;
  const endMinute =
    Math.ceil(
      Math.max(
        1140,
        ...allBlocks.map((a) => a.endMinute),
        ...allFree.map((a) => a.endMinute),
      ) / 60,
    ) * 60;

  const timelineViewport = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (view !== "day" || !timelineViewport.current) return;
    const rows = data.appointments.filter(
      (a) =>
        a.status !== "cancelled" &&
        ymdInTz(new Date(a.startsAt), data.timezone) === date,
    );
    const next =
      rows.find((a) => new Date(a.endsAt) >= new Date(nowIso)) ??
      rows[rows.length - 1];
    const focusMinute = next
      ? minuteInZone(next.startsAt, data.timezone)
      : startMinute;
    timelineViewport.current.scrollTop = Math.max(
      0,
      (focusMinute - startMinute - 30) * 1.6,
    );
  }, [date, view, data.appointments, data.timezone, startMinute, nowIso]);

  function toggle(id: string, pressed: boolean) {
    setFilters((current) =>
      pressed
        ? [
            ...current.filter(
              (f) =>
                !(id === "today" && f === "week") &&
                !(id === "week" && f === "today"),
            ),
            id,
          ]
        : current.filter((f) => f !== id),
    );
    if (pressed && id === "today") {
      setDate(today);
      setView("day");
    }
    if (pressed && id === "week") setView("week");
  }
  function changeDate(next: string) {
    setDate(next);
    setFilters((current) =>
      current.filter((f) => f !== "today" && f !== "week"),
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        label="Vista de agenda"
        value={view}
        onValueChange={(value) => {
          setView(value);
          setFilters((f) => f.filter((id) => id !== "today" && id !== "week"));
        }}
        options={[
          { value: "day", label: "Día" },
          { value: "week", label: "Semana" },
        ]}
        className="sm:w-64"
      />
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Semana anterior"
          onClick={() => changeDate(addDaysYmd(date, -7))}
        >
          <ChevronLeft />
        </Button>
        <div className="min-w-0 text-center">
          <h2 className="text-sm font-semibold capitalize">
            {view === "day"
              ? formatYmdLong(date)
              : `${formatYmdLong(days[0]!)} – ${formatYmdLong(days[6]!)}`}
          </h2>
          <p className="text-xs text-muted-foreground">
            {data.timezone.replace(/_/g, " ")}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Semana siguiente"
          onClick={() => changeDate(addDaysYmd(date, 7))}
        >
          <ChevronRight />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1" aria-label="Días de la semana">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            aria-label={formatYmdLong(day)}
            aria-pressed={date === day}
            onClick={() => changeDate(day)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center rounded-xl text-xs",
              day === date
                ? "bg-primary-soft font-bold text-primary"
                : "bg-card text-muted-foreground",
            )}
          >
            {new Intl.DateTimeFormat("es-MX", {
              weekday: "short",
              timeZone: "UTC",
            }).format(new Date(`${day}T12:00:00Z`))}
            <span className="text-base">{Number(day.slice(-2))}</span>
            {data.appointments.some(
              (a) =>
                a.status !== "cancelled" &&
                ymdInTz(new Date(a.startsAt), data.timezone) === day,
            ) && (
              <span aria-hidden className="size-1 rounded-full bg-current" />
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Filtrar citas">
        {FILTERS.map((filter) => (
          <FilterChip
            key={filter.id}
            pressed={filters.includes(filter.id)}
            onPressedChange={(pressed) => toggle(filter.id, pressed)}
          >
            {filter.label}
          </FilterChip>
        ))}
      </div>
      <AppliedFilters
        count={matches.length}
        filters={FILTERS.filter((f) => filters.includes(f.id))}
        onRemove={(id) => toggle(id, false)}
        onClear={() => setFilters([])}
      />
      <p className="text-xs text-muted-foreground">
        {matches.filter((a) => a.status === "completed").length} completadas ·{" "}
        {matches.filter((a) => a.status === "pending_payment").length} por
        cobrar
      </p>
      {!matches.length && (
        <EmptyState
          title="Sin citas en esta vista"
          description={
            filters.length
              ? "Prueba con otros filtros o límpialos para ver tus citas."
              : "Comparte tu página o elige un hueco libre para agendar."
          }
          action={
            filters.length ? (
              <Button variant="outline" onClick={() => setFilters([])}>
                Limpiar filtros
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href={`/${data.slug}`}>Ver mi página</Link>
              </Button>
            )
          }
        />
      )}
      {view === "day" ? (
        <div
          ref={timelineViewport}
          className="max-h-[60dvh] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card px-2 py-4"
        >
          <Timeline
            label="Agenda del día"
            startMinute={startMinute}
            endMinute={endMinute}
            blocks={dayBlocks(date)}
            freeRanges={free(date)}
            nowMinute={
              date === today ? minuteInZone(nowIso, data.timezone) : undefined
            }
            onBlockClick={setSelectedId}
            onFreeClick={(range) => setGap({ ...range, date })}
          />
        </div>
      ) : (
        <section
          aria-label="Agenda de la semana"
          className="relative ml-8 grid grid-cols-7 rounded-xl border border-border bg-card"
          style={{ height: (endMinute - startMinute) * 0.8 }}
        >
          {Array.from(
            { length: (endMinute - startMinute) / 60 + 1 },
            (_, i) => startMinute + i * 60,
          ).map((minute) => (
            <span
              key={minute}
              aria-hidden
              className="pointer-events-none absolute -left-8 text-xs text-muted-foreground"
              style={{ top: (minute - startMinute) * 0.8 }}
            >
              {minute / 60}
            </span>
          ))}
          {days.map((day) => (
            <div
              key={day}
              className="relative border-l border-border first:border-0"
              aria-label={formatYmdLong(day)}
            >
              {Array.from(
                { length: (endMinute - startMinute) / 60 },
                (_, i) => (
                  <div
                    key={i}
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 border-t border-border"
                    style={{ top: i * 48 }}
                  />
                ),
              )}
              {free(day).map((range) => (
                <button
                  key={`free-${range.startMinute}`}
                  type="button"
                  aria-label={`Libre ${formatYmdLong(day)} ${minuteLabel(range.startMinute)}–${minuteLabel(range.endMinute)}`}
                  className="absolute inset-x-px rounded-sm hover:bg-primary-soft focus-visible:bg-primary-soft"
                  style={{
                    top: (range.startMinute - startMinute) * 0.8,
                    height: (range.endMinute - range.startMinute) * 0.8,
                  }}
                  onClick={() => setGap({ ...range, date: day })}
                />
              ))}
              <ul>
                {dayBlocks(day).map((block) => (
                  <li key={block.id}>
                    <button
                      type="button"
                      aria-label={block.label}
                      onClick={() => setSelectedId(block.id)}
                      className={cn(
                        "absolute inset-x-px overflow-hidden rounded-sm border-2 border-primary bg-primary-soft text-xs font-bold text-primary",
                        block.className,
                      )}
                      style={{
                        top: (block.startMinute - startMinute) * 0.8,
                        height: (block.endMinute - block.startMinute) * 0.8,
                      }}
                    >
                      {block.label.slice(0, 1)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        Borde sólido: confirmada · Punteado: pendiente de pago · Atenuado:
        completada / no asistió. Los huecos Libre respetan tu disponibilidad y
        el margen entre citas.
      </p>
      <Button
        variant="outline"
        onClick={() =>
          setGap({ date, startMinute: 540, endMinute: 600, kind: "block" })
        }
      >
        <Plus /> Bloquear horario
      </Button>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
      >
        <SheetContent side="bottom" className="mx-auto max-w-lg">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.patientName}</SheetTitle>
                <SheetDescription>
                  {formatYmdLong(
                    ymdInTz(new Date(selected.startsAt), data.timezone),
                  )}{" "}
                  · {formatTimeInTz(new Date(selected.startsAt), data.timezone)}
                  –{formatTimeInTz(new Date(selected.endsAt), data.timezone)} ·{" "}
                  {selected.serviceName} ·{" "}
                  {selected.modality === "online" ? "Online" : "Presencial"}
                </SheetDescription>
              </SheetHeader>
              <Badge
                variant={STATUS_BADGE_VARIANT[selected.status]}
                className="w-fit"
              >
                {STATUS_LABEL[selected.status]}
              </Badge>
              {selected.modality === "online" &&
                selected.meetUrl &&
                selectedActive && (
                  <Button asChild>
                    <a href={selected.meetUrl} target="_blank" rel="noreferrer">
                      Abrir Meet
                    </a>
                  </Button>
                )}
              <AppointmentActions
                appointmentId={selected.id}
                patientName={selected.patientName}
                status={selected.status}
                started={new Date(selected.startsAt) <= new Date(nowIso)}
                primaryCompletion={
                  !(selected.modality === "online" && selected.meetUrl)
                }
              />
              {selected.patientPhone && (
                <Button variant="outline" asChild>
                  <a
                    href={`https://wa.me/${selected.patientPhone.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp al paciente
                  </a>
                </Button>
              )}
              <Button variant="outline" asChild>
                <Link href={`/app/agenda/${selected.id}`}>
                  Ver detalle completo
                </Link>
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>
      <GapSheet
        key={gap ? `${gap.date}-${gap.startMinute}` : "closed"}
        gap={gap}
        data={data}
        onClose={() => setGap(null)}
      />
    </div>
  );
}

function GapSheet({
  gap,
  data,
  onClose,
}: {
  gap: (TimelineRange & { date: string; kind?: string }) | null;
  data: AgendaData;
  onClose: () => void;
}) {
  const [mode, setMode] = React.useState(gap?.kind ?? "new");
  const [start, setStart] = React.useState(
    minuteLabel(gap?.startMinute ?? 540),
  );
  const [end, setEnd] = React.useState(
    minuteLabel(Math.min(gap?.endMinute ?? 600, 1439)),
  );
  const [pending, startTransition] = React.useTransition();
  const service = [...data.services]
    .filter((s) => s.isActive)
    .sort((a, b) => a.durationMin - b.durationMin)[0];
  const query =
    gap && service
      ? new URLSearchParams({
          paso: "3",
          servicio: service.id,
          fecha: gap.date,
          hora: zonedTimeToUtc(
            gap.date,
            parseTimeToMinutes(start),
            data.timezone,
          ).toISOString(),
        })
      : null;
  return (
    <Sheet open={!!gap} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="mx-auto max-w-lg">
        <SheetHeader>
          <SheetTitle>Nueva cita / Bloquear</SheetTitle>
          <SheetDescription>
            {gap
              ? `${formatYmdLong(gap.date)} · ${minuteLabel(gap.startMinute)}–${minuteLabel(gap.endMinute)}`
              : "Elige qué hacer con este horario."}
          </SheetDescription>
        </SheetHeader>
        <SegmentedControl
          label="Acción del horario"
          value={mode}
          onValueChange={setMode}
          options={[
            { value: "new", label: "Nueva cita" },
            { value: "block", label: "Bloquear" },
          ]}
        />
        {mode === "new" ? (
          <>
            <p className="text-sm text-muted-foreground">
              Completa los datos del paciente en el flujo de reserva. La
              disponibilidad se vuelve a validar al confirmar.
            </p>
            {query ? (
              <Button asChild>
                <Link href={`/${data.slug}/agendar?${query}`}>
                  Agendar {service?.name}
                </Link>
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href="/app/agenda?tab=servicios">Crear servicio</Link>
              </Button>
            )}
          </>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!gap) return;
              startTransition(async () => {
                const result = await addAvailabilityOverride({
                  date: gap.date,
                  startTime: start,
                  endTime: end,
                  isBlocked: true,
                });
                if (result.ok) {
                  toast.success("Horario bloqueado");
                  onClose();
                } else toast.error(result.error);
              });
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="block-start">Desde</Label>
                <Input
                  id="block-start"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="block-end">Hasta</Label>
                <Input
                  id="block-end"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" loading={pending}>
              Guardar bloqueo
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
