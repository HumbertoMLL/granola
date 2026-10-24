import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalendarCheck2, MapPin, MessageCircle, Video } from "lucide-react";

import { Badge, Button, Card, Skeleton } from "@granola/ui";
import { formatDateInTz, formatTimeInTz, timeZoneLabel } from "@granola/core/scheduling";

import { PublicShell } from "@/components/booking/public-shell";
import { STATUS_BADGE_VARIANT, STATUS_LABEL, formatPrice } from "@/components/booking/format";
import { appointments, db, eq } from "@/lib/db";
import { getPublicNutritionistBySlug } from "@/lib/booking";

export const metadata: Metadata = { title: "Cita agendada", robots: { index: false } };

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cita?: string | string[]; pago?: string | string[] }>;
};

export default function ListoPage(props: Props) {
  return (
    <Suspense fallback={<ListoSkeleton />}>
      <ListoContent {...props} />
    </Suspense>
  );
}

async function ListoContent({ params, searchParams }: Props) {
  await connection();
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const token = Array.isArray(sp.cita) ? sp.cita[0] : sp.cita;
  const pagoPendiente = (Array.isArray(sp.pago) ? sp.pago[0] : sp.pago) === "pendiente";
  if (!token) notFound();

  const nutri = await getPublicNutritionistBySlug(slug);
  if (!nutri) notFound();

  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.cancelToken, token),
    columns: { id: true, startsAt: true, endsAt: true, status: true, modality: true, nutritionistId: true },
    with: {
      service: { columns: { name: true, priceCents: true, currency: true, location: true, paymentMode: true } },
      patient: { columns: { name: true } },
    },
  });
  if (!appt || appt.nutritionistId !== nutri.id) notFound();

  // El paciente ve la hora en la zona de la nutri (no guardamos la suya); el link
  // de gestión la muestra en la del navegador.
  const tz = nutri.timezone;
  const firstName = appt.patient.name.split(/\s+/)[0] ?? appt.patient.name;

  return (
    <PublicShell nutritionist={nutri}>
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <CalendarCheck2 className="size-8" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight">¡Listo, {firstName}!</h1>
          <p className="text-muted-foreground">Tu cita con {nutri.displayName} quedó agendada.</p>
        </div>

        <Card className="w-full gap-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <p className="font-semibold">{appt.service.name}</p>
            <Badge variant={STATUS_BADGE_VARIANT[appt.status]}>{STATUS_LABEL[appt.status]}</Badge>
          </div>
          <div>
            <p className="text-lg font-bold capitalize">{formatDateInTz(appt.startsAt, tz)}</p>
            <p className="font-semibold tabular-nums">
              {formatTimeInTz(appt.startsAt, tz)} – {formatTimeInTz(appt.endsAt, tz)}{" "}
              <span className="text-sm font-normal text-muted-foreground">({timeZoneLabel(tz)})</span>
            </p>
          </div>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            {appt.modality === "online" ? (
              <>
                <Video className="size-4" /> En línea · el link te llega antes de la cita
              </>
            ) : (
              <>
                <MapPin className="size-4" /> {appt.service.location ?? "Presencial"}
              </>
            )}
          </p>
          {appt.service.priceCents > 0 ? (
            <p className="text-sm text-muted-foreground">
              Costo: <span className="font-semibold text-foreground">{formatPrice(appt.service.priceCents, appt.service.currency)}</span>
              {appt.service.paymentMode === "at_visit" ? " · se paga en consulta" : null}
            </p>
          ) : null}
        </Card>

        {pagoPendiente ? (
          <Card className="w-full gap-1 border-accent/40 bg-accent-soft text-left">
            <p className="font-semibold">Pagos en línea próximamente</p>
            <p className="text-sm text-muted-foreground">
              Tu cita ya está confirmada. Por ahora el pago se coordina directamente con {nutri.displayName}.
            </p>
          </Card>
        ) : null}

        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <MessageCircle className="size-4 text-primary" /> Te llegará confirmación por WhatsApp.
        </p>

        <div className="flex w-full flex-col gap-2">
          <Button variant="outline" asChild>
            <Link href={`/cita/${encodeURIComponent(token)}`}>Reagendar o cancelar</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href={`/${nutri.slug}`}>Volver a la página de {nutri.displayName}</Link>
          </Button>
        </div>
      </div>
    </PublicShell>
  );
}

function ListoSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-10">
      <Skeleton className="size-16 rounded-full" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
