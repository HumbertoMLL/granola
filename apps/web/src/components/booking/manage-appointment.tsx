"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, CalendarX2, MapPin, Video } from "lucide-react";

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
  toast,
} from "@granola/ui";
import { formatDateInTz, formatTimeInTz, timeZoneLabel } from "@granola/core/scheduling";

import { cancelByPatient, fetchRescheduleSlots, rescheduleByPatient } from "@/app/cita/[cancelToken]/actions";
import { STATUS_BADGE_VARIANT, STATUS_LABEL, type AppointmentModality, type AppointmentStatus } from "@/components/booking/format";
import { SlotPicker, useDetectedTimezone, type SlotIso } from "@/components/booking/slot-picker";

export type ManageAppointmentData = {
  token: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  modality: AppointmentModality;
  serviceName: string;
  location: string | null;
  meetUrl: string | null;
  patientFirstName: string;
  nutritionistName: string;
  nutritionistSlug: string;
  nutritionistTimezone: string;
  /** false si falta poco o ya pasó: solo lectura. */
  canChange: boolean;
  nowIso: string;
};

export function ManageAppointment({ data }: { data: ManageAppointmentData }) {
  const [tzOverride, setTzOverride] = React.useState<string | null>(null);
  const detectedTz = useDetectedTimezone(data.nutritionistTimezone);
  const timezone = tzOverride ?? detectedTz;
  const [mode, setMode] = React.useState<"view" | "reschedule">("view");
  const [slots, setSlots] = React.useState<SlotIso[] | null>(null);
  const [selected, setSelected] = React.useState<SlotIso | null>(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (mode !== "reschedule") return;
    let cancelled = false;
    fetchRescheduleSlots(data.token).then((res) => {
      if (cancelled) return;
      if (res.ok) setSlots(res.slots);
      else {
        setSlots([]);
        toast.error(res.error);
        setMode("view");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mode, data.token]);

  function openReschedule() {
    setSlots(null);
    setSelected(null);
    setMode("reschedule");
  }

  const start = new Date(data.startsAt);
  const end = new Date(data.endsAt);
  const isActive = data.status === "confirmed" || data.status === "pending_payment";

  function confirmReschedule() {
    if (!selected) return;
    startTransition(async () => {
      const res = await rescheduleByPatient(data.token, selected.startsAt);
      if (res.ok) {
        toast.success("Cita reagendada. Te llega la confirmación por WhatsApp.");
        setMode("view");
        setSelected(null);
      } else toast.error(res.error);
    });
  }

  function confirmCancel() {
    startTransition(async () => {
      const res = await cancelByPatient(data.token);
      if (res.ok) {
        toast.success("Cita cancelada");
        setCancelOpen(false);
      } else toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Hola, {data.patientFirstName}</h1>
        <p className="text-muted-foreground">
          {isActive ? "Aquí puedes ver, reagendar o cancelar tu cita." : "Esta es tu cita."}
        </p>
      </div>

      <Card className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{data.serviceName}</p>
            <p className="font-semibold">con {data.nutritionistName}</p>
          </div>
          <Badge variant={STATUS_BADGE_VARIANT[data.status]}>{STATUS_LABEL[data.status]}</Badge>
        </div>
        <div>
          <p className="text-lg font-bold capitalize">{formatDateInTz(start, timezone)}</p>
          <p className="font-semibold tabular-nums">
            {formatTimeInTz(start, timezone)} – {formatTimeInTz(end, timezone)}{" "}
            <span className="text-sm font-normal text-muted-foreground">({timeZoneLabel(timezone)})</span>
          </p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          {data.modality === "online" ? (
            <>
              <Video className="size-4" />
              {data.meetUrl ? (
                <a href={data.meetUrl} className="underline" target="_blank" rel="noreferrer">
                  Entrar a la videollamada
                </a>
              ) : (
                "En línea · el link te llega antes de la cita"
              )}
            </>
          ) : (
            <>
              <MapPin className="size-4" /> {data.location ?? "Presencial"}
            </>
          )}
        </p>
      </Card>

      {isActive && data.canChange && mode === "view" ? (
        <div className="flex flex-col gap-2">
          <Button variant="outline" size="lg" onClick={openReschedule}>
            <CalendarClock /> Reagendar
          </Button>
          <Button variant="ghost" size="lg" className="text-destructive" onClick={() => setCancelOpen(true)}>
            <CalendarX2 /> Cancelar cita
          </Button>
        </div>
      ) : null}

      {isActive && !data.canChange ? (
        <p className="text-sm text-muted-foreground">
          Faltan menos de 2 horas para tu cita, así que ya no se puede cambiar desde aquí. Si necesitas algo,
          escríbele directamente a {data.nutritionistName}.
        </p>
      ) : null}

      {data.status === "cancelled" ? (
        <Button asChild size="lg">
          <Link href={`/${data.nutritionistSlug}/agendar`}>Agendar una nueva cita</Link>
        </Button>
      ) : null}

      {mode === "reschedule" ? (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold">Elige el nuevo horario</h2>
          <SlotPicker
            slots={slots}
            timezone={timezone}
            onTimezoneChange={setTzOverride}
            selected={selected?.startsAt ?? null}
            onSelect={setSelected}
            nowIso={data.nowIso}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setMode("view");
                setSelected(null);
              }}
              disabled={pending}
            >
              Volver
            </Button>
            <Button className="flex-1" disabled={!selected} loading={pending} onClick={confirmReschedule}>
              Confirmar cambio
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar tu cita?</DialogTitle>
            <DialogDescription>
              Le avisaremos a {data.nutritionistName}. Si prefieres, puedes reagendar en lugar de cancelar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={pending}>
              Volver
            </Button>
            <Button variant="destructive" loading={pending} onClick={confirmCancel}>
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
