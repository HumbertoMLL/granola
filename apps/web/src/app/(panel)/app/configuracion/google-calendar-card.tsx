"use client";

import { useState, useTransition } from "react";
import { CalendarSync } from "lucide-react";
import { authClient } from "@granola/auth/client";
import { Button, Card } from "@granola/ui";
import { disconnectGoogleCalendar } from "./calendar-actions";

export function GoogleCalendarCard({ connected, configured }: { connected: boolean; configured: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function act() {
    setError(null);
    startTransition(async () => {
      try {
        if (connected) await disconnectGoogleCalendar();
        else {
          const result = await authClient.linkSocial({ provider: "google", callbackURL: "/app/configuracion", errorCallbackURL: "/app/configuracion", scopes: [
            "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy",
          ] });
          if (result.error) setError("No pudimos conectar Google Calendar. Intenta de nuevo.");
        }
      } catch {
        setError("No pudimos actualizar la conexión. Intenta de nuevo.");
      }
    });
  }
  return (
    <Card>
      <div className="flex items-center gap-3"><CalendarSync aria-hidden="true" /><h2 className="font-semibold">Google Calendar</h2></div>
      <p className="text-sm text-muted-foreground">{connected ? "Conectado. Tus citas se sincronizan y respetamos tus horarios ocupados." : "Conecta tu cuenta para sincronizar citas, crear links de Meet y respetar tus horarios ocupados."}</p>
      {!configured && !connected ? <p className="text-sm text-muted-foreground">La conexión con Google Calendar aún no está disponible.</p> : null}
      <Button className="self-start" variant={connected ? "outline" : "primary"} disabled={pending || (!configured && !connected)} onClick={act}>
        {pending ? "Actualizando…" : connected ? "Desconectar" : "Conectar Google Calendar"}
      </Button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </Card>
  );
}
