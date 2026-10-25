"use client";

import { useState, useTransition } from "react";
import { authClient } from "@granola/auth/client";
import { Badge, Button, SectionHeader } from "@granola/ui";
import { disconnectGoogleCalendar } from "./calendar-actions";

export function GoogleCalendarCard({
  connected,
  configured,
}: {
  connected: boolean;
  configured: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function act() {
    setError(null);
    startTransition(async () => {
      try {
        if (connected) await disconnectGoogleCalendar();
        else {
          const result = await authClient.linkSocial({
            provider: "google",
            callbackURL: "/app/configuracion",
            errorCallbackURL: "/app/configuracion",
            scopes: [
              "https://www.googleapis.com/auth/calendar.events",
              "https://www.googleapis.com/auth/calendar.freebusy",
            ],
          });
          if (result.error)
            setError("No pudimos conectar Google Calendar. Intenta de nuevo.");
        }
      } catch {
        setError("No pudimos actualizar la conexión. Intenta de nuevo.");
      }
    });
  }
  return (
    <section className="grid gap-3">
      <SectionHeader title="Conexiones" />
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-4">
        <div className="min-w-0 flex-1 basis-48">
          <h3 className="font-medium">Google Calendar</h3>
          <p className="text-sm text-muted-foreground">
            {connected
              ? "Citas y horarios ocupados sincronizados."
              : "Sincroniza tus citas y enlaces de Meet."}
          </p>
        </div>
        <Badge variant={connected ? "confirmed" : "done"}>
          {connected
            ? "Conectado"
            : configured
              ? "Sin conectar"
              : "No disponible"}
        </Badge>
        <Button
          className="w-full self-start sm:w-auto"
          variant="outline"
          disabled={pending || (!configured && !connected)}
          onClick={act}
        >
          {pending
            ? "Actualizando…"
            : connected
              ? "Desconectar"
              : "Conectar Google Calendar"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive-ink">
          {error}
        </p>
      ) : null}
    </section>
  );
}
