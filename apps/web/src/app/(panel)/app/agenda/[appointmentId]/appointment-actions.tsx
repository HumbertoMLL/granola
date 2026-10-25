"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarX2, Check, UserX } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
  Label,
  toast,
} from "@granola/ui";

import {
  cancelAppointment,
  completeAppointment,
  confirmAppointmentManually,
  markNoShow,
} from "@/app/(panel)/app/agenda/actions";
import type { AppointmentStatus } from "@/components/booking/format";

type Props = {
  appointmentId: string;
  patientName: string;
  status: AppointmentStatus;
  /** La cita ya empezó (calculado en servidor): habilita completada / no asistió. */
  started: boolean;
  primaryCompletion?: boolean;
};

/** Acciones del detalle de cita. Reusa las server actions de la lista de agenda. */
export function AppointmentActions({
  appointmentId,
  patientName,
  status,
  started,
  primaryCompletion = true,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const active = status === "confirmed" || status === "pending_payment";
  if (!active) return null;

  function run(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    after?: () => void,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(label);
        after?.();
        router.refresh();
      } else toast.error(res.error ?? "Algo salió mal");
    });
  }

  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {status === "pending_payment" ? (
          <Button
            variant="outline"
            loading={pending}
            onClick={() =>
              run("Cita confirmada", () =>
                confirmAppointmentManually(appointmentId),
              )
            }
          >
            <Check /> Confirmar pago
          </Button>
        ) : null}
        {started ? (
          <>
            <Button
              variant={primaryCompletion ? "primary" : "outline"}
              loading={pending}
              onClick={() =>
                run("Marcada como completada", () =>
                  completeAppointment(appointmentId),
                )
              }
            >
              <Check /> Completada
            </Button>
            <Button
              variant="outline"
              loading={pending}
              onClick={() =>
                run("Marcada como no asistió", () => markNoShow(appointmentId))
              }
            >
              <UserX /> No asistió
            </Button>
          </>
        ) : null}
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={() => setCancelOpen(true)}
        >
          <CalendarX2 /> Cancelar cita
        </Button>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar la cita de {patientName}</DialogTitle>
            <DialogDescription>
              Le avisaremos por WhatsApp. Puedes agregar un motivo (opcional).
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="cancel-reason">Motivo (opcional)</Label>
          <Textarea
            id="cancel-reason"
            placeholder="Ej. Tuve una emergencia, te escribo para reagendar"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={pending}
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              loading={pending}
              onClick={() =>
                run(
                  "Cita cancelada",
                  () => cancelAppointment(appointmentId, reason),
                  () => setCancelOpen(false),
                )
              }
            >
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
