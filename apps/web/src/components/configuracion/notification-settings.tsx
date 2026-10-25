"use client";

import { useState, useTransition } from "react";
import { Card, Label, Switch, toast } from "@granola/ui";
import { saveNotifications } from "@/app/(panel)/app/configuracion/actions";

export function NotificationSettings({ notifyNewBooking }: { notifyNewBooking: boolean }) {
  const [enabled, setEnabled] = useState(notifyNewBooking);
  const [pending, startTransition] = useTransition();

  function save(value: boolean) {
    startTransition(async () => {
      try {
        const result = await saveNotifications({ notifyNewBooking: value });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setEnabled(value);
        toast.success("Preferencias de notificaciones guardadas");
      } catch {
        toast.error("No se pudo guardar. Intenta de nuevo.");
      }
    });
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold">Notificaciones</h2>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="notify-new-booking" className="leading-relaxed">
          Avisarme por WhatsApp cuando agenden
        </Label>
        <Switch
          id="notify-new-booking"
          checked={enabled}
          onCheckedChange={save}
          disabled={pending}
          aria-describedby="notify-new-booking-help"
        />
      </div>
      <p id="notify-new-booking-help" className="text-sm text-muted-foreground">
        Recibe un aviso en tu número de WhatsApp cuando un paciente confirme una cita.
      </p>
    </Card>
  );
}
