"use client";

import { useState, useTransition } from "react";
import { Label, SectionHeader, Switch, toast } from "@granola/ui";
import { saveNotifications } from "@/app/(panel)/app/configuracion/actions";

export function NotificationSettings({ notifyNewBooking }: { notifyNewBooking: boolean }) {
  const [enabled, setEnabled] = useState(notifyNewBooking);
  const [pending, startTransition] = useTransition();

  function save(value: boolean) {
    const previous = enabled;
    setEnabled(value);
    startTransition(async () => {
      try {
        const result = await saveNotifications({ notifyNewBooking: value });
        if (!result.ok) {
          setEnabled(previous);
          toast.error(result.error);
          return;
        }
        toast.success("Preferencias de notificaciones guardadas");
      } catch {
        setEnabled(previous);
        toast.error("No se pudo guardar. Intenta de nuevo.");
      }
    });
  }

  return (
    <section className="grid gap-3">
      <SectionHeader title="Notificaciones" />
      <div className="flex items-center justify-between gap-4 border-y border-border py-4">
        <div className="min-w-0 flex-1">
          <Label htmlFor="notify-new-booking" className="font-medium">
            Avisarme por WhatsApp cuando agenden
          </Label>
          <p id="notify-new-booking-help" className="text-sm text-muted-foreground">
            Recibe un aviso en tu número de WhatsApp cuando un paciente confirme una cita.
          </p>
        </div>
        <Switch
          id="notify-new-booking"
          checked={enabled}
          onCheckedChange={save}
          disabled={pending}
          aria-busy={pending}
          aria-describedby="notify-new-booking-help"
        />
      </div>
    </section>
  );
}
