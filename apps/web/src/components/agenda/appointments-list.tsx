"use client";

import * as React from "react";
import { CalendarCheck, CalendarX2, Check, Clock, MapPin, UserX, Video } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
  toast,
} from "@granola/ui";
import { formatTimeInTz, formatYmdLong, ymdInTz } from "@granola/core/scheduling";

import {
  cancelAppointment,
  completeAppointment,
  confirmAppointmentManually,
  markNoShow,
} from "@/app/(panel)/app/agenda/actions";
import { formatPhoneForDisplay } from "@/components/booking/phone";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  type AppointmentModality,
  type AppointmentStatus,
} from "@/components/booking/format";

export type AppointmentRow = {
  id: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  status: AppointmentStatus;
  modality: AppointmentModality;
  meetUrl: string | null;
  patientName: string;
  patientPhone: string | null;
  serviceName: string;
  durationMin: number;
};

type Props = {
  appointments: AppointmentRow[];
  timezone: string;
  /** ISO de "ahora" calculado en servidor para que SSR y cliente coincidan. */
  nowIso: string;
};

export function AppointmentsList({ appointments, timezone, nowIso }: Props) {
  const now = new Date(nowIso).getTime();
  const upcoming = appointments.filter(
    (a) => new Date(a.endsAt).getTime() >= now && a.status !== "cancelled",
  );
  const past = appointments.filter((a) => new Date(a.endsAt).getTime() < now || a.status === "cancelled");

  return (
    <div className="flex flex-col gap-8">
      <Section title="Próximas" count={upcoming.length} emptyIcon={CalendarCheck} empty="Sin citas próximas. Comparte tu página para que agenden contigo.">
        <DayGroups rows={upcoming} timezone={timezone} nowIso={nowIso} />
      </Section>
      <Section title="Pasadas y canceladas" count={past.length} emptyIcon={Clock} empty="Aquí aparecerán las citas que ya pasaron.">
        <DayGroups rows={past} timezone={timezone} nowIso={nowIso} reverse />
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
  empty,
  emptyIcon: Icon,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  empty: string;
  emptyIcon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <Badge variant="secondary">{count}</Badge>
      </div>
      {count === 0 ? (
        <Card className="items-center gap-2 border-dashed py-8 text-center shadow-none">
          <Icon className="size-6 text-muted-foreground" />
          <p className="max-w-xs text-sm text-muted-foreground">{empty}</p>
        </Card>
      ) : (
        children
      )}
    </section>
  );
}

function DayGroups({
  rows,
  timezone,
  nowIso,
  reverse = false,
}: {
  rows: AppointmentRow[];
  timezone: string;
  nowIso: string;
  reverse?: boolean;
}) {
  // Agrupar por día civil en la zona del nutri.
  const map = new Map<string, AppointmentRow[]>();
  for (const r of rows) {
    const key = ymdInTz(new Date(r.startsAt), timezone);
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  const dir = reverse ? -1 : 1;
  const groups = [...map.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0) * dir)
    .map(([date, list]) => ({
      date,
      rows: list.sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0) * dir),
    }));

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.date} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {formatYmdLong(g.date, "es-MX", { year: "numeric" })}
          </h3>
          <ul className="flex flex-col gap-2">
            {g.rows.map((row) => (
              <AppointmentCard key={row.id} row={row} timezone={timezone} nowIso={nowIso} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AppointmentCard({ row, timezone, nowIso }: { row: AppointmentRow; timezone: string; nowIso: string }) {
  const [pending, startTransition] = React.useTransition();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const start = new Date(row.startsAt);
  const end = new Date(row.endsAt);
  const isPast = end.getTime() < new Date(nowIso).getTime();
  const active = row.status === "confirmed" || row.status === "pending_payment";

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(label);
      else toast.error(res.error ?? "Algo salió mal");
    });
  }

  return (
    <li>
      <Card className="gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-lg font-bold tabular-nums">
              {formatTimeInTz(start, timezone)}
              <span className="text-sm font-normal text-muted-foreground"> – {formatTimeInTz(end, timezone)}</span>
            </p>
            <p className="truncate font-semibold">{row.patientName}</p>
            <p className="truncate text-sm text-muted-foreground">
              {row.serviceName} · {row.durationMin} min
            </p>
          </div>
          <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{STATUS_LABEL[row.status]}</Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            {row.modality === "online" ? <Video className="size-4" /> : <MapPin className="size-4" />}
            {row.modality === "online" ? "En línea" : "Presencial"}
          </span>
          {row.patientPhone ? (
            <a
              className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
              href={`https://wa.me/${row.patientPhone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
            >
              {formatPhoneForDisplay(row.patientPhone)}
            </a>
          ) : null}
          {row.meetUrl ? (
            <a className="hover:underline" href={row.meetUrl} target="_blank" rel="noreferrer">
              Link de videollamada
            </a>
          ) : null}
        </div>

        {active ? (
          <div className="flex flex-wrap gap-2">
            {row.status === "pending_payment" ? (
              <Button
                size="sm"
                variant="outline"
                loading={pending}
                onClick={() => run("Cita confirmada", () => confirmAppointmentManually(row.id))}
              >
                <Check /> Confirmar pago
              </Button>
            ) : null}
            {isPast ? (
              <>
                <Button
                  size="sm"
                  loading={pending}
                  onClick={() => run("Marcada como completada", () => completeAppointment(row.id))}
                >
                  <Check /> Completada
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  loading={pending}
                  onClick={() => run("Marcada como no asistió", () => markNoShow(row.id))}
                >
                  <UserX /> No asistió
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => setCancelOpen(true)}>
              <CalendarX2 /> Cancelar
            </Button>
          </div>
        ) : null}
      </Card>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar la cita de {row.patientName}</DialogTitle>
            <DialogDescription>
              Le avisaremos por WhatsApp. Puedes agregar un motivo (opcional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Ej. Tuve una emergencia, te escribo para reagendar"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={pending}>
              Volver
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() =>
                run("Cita cancelada", async () => {
                  const res = await cancelAppointment(row.id, reason);
                  if (res.ok) setCancelOpen(false);
                  return res;
                })
              }
            >
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
