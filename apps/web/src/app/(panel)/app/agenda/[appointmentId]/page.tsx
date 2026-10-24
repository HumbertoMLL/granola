import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, MessageCircle, Star, Video } from "lucide-react";
import { z } from "zod";

import { Badge, Button, Card, Separator, Skeleton } from "@granola/ui";
import { formatDateInTz, formatInTz, formatTimeInTz, timeZoneLabel } from "@granola/core/scheduling";

import {
  formatDuration,
  formatPrice,
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
} from "@/components/booking/format";
import { formatPhoneForDisplay } from "@/components/booking/phone";
import { and, appointments, db, desc, eq, waMessages } from "@/lib/db";
import { requireNutritionist } from "@/lib/session";

import { AppointmentActions } from "./appointment-actions";

export const metadata: Metadata = { title: "Detalle de cita" };

type Props = { params: Promise<{ appointmentId: string }> };

/** Cuántos WhatsApp del paciente se muestran. */
const WA_HISTORY_LIMIT = 10;

const PAYMENT_METHOD_LABEL = { card: "Tarjeta", spei: "SPEI", oxxo: "OXXO", cash: "Efectivo" } as const;
const PAYMENT_STATUS_LABEL = {
  pending: "Pendiente",
  paid: "Pagado",
  failed: "Fallido",
  expired: "Expirado",
  refunded: "Reembolsado",
} as const;
const PAYMENT_STATUS_VARIANT = {
  pending: "accent",
  paid: "default",
  failed: "destructive",
  expired: "secondary",
  refunded: "outline",
} as const;

const WA_STATUS_LABEL = { queued: "En cola", sent: "Enviado", delivered: "Entregado", read: "Leído", failed: "Falló" } as const;
const WA_STATUS_VARIANT = {
  queued: "secondary",
  sent: "outline",
  delivered: "outline",
  read: "default",
  failed: "destructive",
} as const;
const WA_TEMPLATE_LABEL: Record<string, string> = {
  cita_confirmada: "Cita confirmada",
  recordatorio_24h: "Recordatorio 24 h",
  recordatorio_2h: "Recordatorio 2 h",
  cita_cancelada: "Cita cancelada",
  cita_reagendada: "Cita reagendada",
  pago_pendiente_oxxo: "Pago pendiente",
  pide_resena: "Pide reseña",
  nueva_cita_nutri: "Nueva cita",
};

/** Destino del botón "Ver en mi agenda" de la plantilla `nueva_cita_nutri`. */
export default function AppointmentDetailPage(props: Props) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Suspense fallback={<DetailSkeleton />}>
        <DetailContent {...props} />
      </Suspense>
    </div>
  );
}

async function DetailContent({ params }: Props) {
  const { nutritionist } = await requireNutritionist();
  const { appointmentId } = await params;
  // Un id que no es uuid haría fallar el cast en Postgres: 404 directo.
  if (!z.uuid().safeParse(appointmentId).success) notFound();

  // Regla dura #1: siempre filtrado por el nutri de la sesión.
  const appt = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, appointmentId), eq(appointments.nutritionistId, nutritionist.id)),
    with: {
      patient: { columns: { id: true, name: true, phoneWa: true, email: true } },
      service: { columns: { name: true, durationMin: true, location: true } },
      payments: {
        columns: { id: true, method: true, amountCents: true, currency: true, status: true, paidAt: true, createdAt: true },
        orderBy: (p, { desc }) => [desc(p.createdAt)],
      },
      reviews: { columns: { rating: true, text: true, isPublic: true }, limit: 1 },
    },
  });
  if (!appt) notFound();

  const waRows = await db.query.waMessages.findMany({
    where: and(eq(waMessages.nutritionistId, nutritionist.id), eq(waMessages.patientId, appt.patient.id)),
    columns: { id: true, template: true, direction: true, status: true, errorCode: true, createdAt: true },
    orderBy: [desc(waMessages.createdAt)],
    limit: WA_HISTORY_LIMIT,
  });

  const tz = nutritionist.timezone;
  const start = appt.startsAt;
  const end = appt.endsAt;
  const now = new Date();
  const started = start.getTime() <= now.getTime();
  const patientTz = appt.patientTimezone && appt.patientTimezone !== tz ? appt.patientTimezone : null;
  const waDigits = appt.patient.phoneWa?.replace(/\D/g, "") ?? null;
  const review = appt.reviews[0] ?? null;
  const shortDateTime = (d: Date) =>
    formatInTz(d, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return (
    <>
      <div className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-3 self-start">
          <Link href="/app/agenda">
            <ArrowLeft /> Agenda
          </Link>
        </Button>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-extrabold tracking-tight md:text-3xl">{appt.patient.name}</h1>
            <p className="text-sm text-muted-foreground">
              {appt.service.name} · {formatDuration(appt.service.durationMin)}
            </p>
          </div>
          <Badge variant={STATUS_BADGE_VARIANT[appt.status]} className="shrink-0">
            {STATUS_LABEL[appt.status]}
          </Badge>
        </div>
      </div>

      <Card className="gap-4">
        <div>
          <p className="text-lg font-bold capitalize">{formatDateInTz(start, tz)}</p>
          <p className="font-semibold tabular-nums">
            {formatTimeInTz(start, tz)} – {formatTimeInTz(end, tz)}{" "}
            <span className="text-sm font-normal text-muted-foreground">({timeZoneLabel(tz, start)})</span>
          </p>
          {patientTz ? (
            <p className="text-sm text-muted-foreground">
              Para el paciente: {formatTimeInTz(start, patientTz)} ({timeZoneLabel(patientTz, start)})
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          {appt.modality === "online" ? (
            <p className="inline-flex items-center gap-2">
              <Video className="size-4 text-muted-foreground" aria-hidden />
              {appt.meetUrl ? (
                <a href={appt.meetUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                  Entrar a la videollamada
                </a>
              ) : (
                <span>En línea · sin link de videollamada todavía</span>
              )}
            </p>
          ) : (
            <p className="inline-flex items-center gap-2">
              <MapPin className="size-4 text-muted-foreground" aria-hidden />
              {appt.service.location ?? "Presencial"}
            </p>
          )}
          {appt.notes ? (
            <p className="rounded-xl bg-secondary/60 p-3">
              <span className="font-medium">Nota del paciente:</span> {appt.notes}
            </p>
          ) : null}
          {appt.status === "cancelled" && appt.cancelReason ? (
            <p className="text-muted-foreground">Motivo de cancelación: {appt.cancelReason}</p>
          ) : null}
        </div>
        <AppointmentActions
          appointmentId={appt.id}
          patientName={appt.patient.name}
          status={appt.status}
          started={started}
        />
      </Card>

      <Section title="Paciente">
        <Card className="gap-2 text-sm">
          {appt.patient.phoneWa && waDigits ? (
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-medium hover:underline"
            >
              <MessageCircle className="size-4 text-primary" aria-hidden />
              {formatPhoneForDisplay(appt.patient.phoneWa)}
            </a>
          ) : (
            <p className="text-muted-foreground">Sin WhatsApp registrado</p>
          )}
          {appt.patient.email ? (
            <a href={`mailto:${appt.patient.email}`} className="inline-flex items-center gap-2 hover:underline">
              <Mail className="size-4 text-muted-foreground" aria-hidden />
              {appt.patient.email}
            </a>
          ) : null}
        </Card>
      </Section>

      <Section title="Pagos">
        {appt.payments.length === 0 ? (
          <Empty>Sin pagos registrados para esta cita.</Empty>
        ) : (
          <Card className="gap-0 py-1">
            <ul>
              {appt.payments.map((p, i) => (
                <li key={p.id}>
                  {i > 0 ? <Separator /> : null}
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold tabular-nums">{formatPrice(p.amountCents, p.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {PAYMENT_METHOD_LABEL[p.method]} · {shortDateTime(p.paidAt ?? p.createdAt)}
                      </p>
                    </div>
                    <Badge variant={PAYMENT_STATUS_VARIANT[p.status]}>{PAYMENT_STATUS_LABEL[p.status]}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>

      <Section title="WhatsApp con el paciente" hint={`Últimos ${WA_HISTORY_LIMIT}`}>
        {waRows.length === 0 ? (
          <Empty>Todavía no hay mensajes de WhatsApp con este paciente.</Empty>
        ) : (
          <Card className="gap-0 py-1">
            <ul>
              {waRows.map((m, i) => (
                <li key={m.id}>
                  {i > 0 ? <Separator /> : null}
                  <div className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {m.direction === "inbound"
                          ? "Respuesta del paciente"
                          : (m.template && WA_TEMPLATE_LABEL[m.template]) ?? m.template ?? "Mensaje"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {shortDateTime(m.createdAt)}
                        {m.status === "failed" && m.errorCode ? ` · error ${m.errorCode}` : ""}
                      </p>
                    </div>
                    {m.direction === "outbound" ? (
                      <Badge variant={WA_STATUS_VARIANT[m.status]}>{WA_STATUS_LABEL[m.status]}</Badge>
                    ) : (
                      <Badge variant="secondary">Recibido</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>

      {review ? (
        <Section title="Reseña">
          <Card className="gap-2 text-sm">
            <p className="inline-flex items-center gap-1" aria-label={`${review.rating} de 5 estrellas`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  aria-hidden
                  className={n <= review.rating ? "size-4 fill-accent text-accent" : "size-4 text-border"}
                />
              ))}
              <span className="ml-2 text-xs text-muted-foreground">{review.isPublic ? "Pública" : "Privada"}</span>
            </p>
            {review.text ? <p>{review.text}</p> : null}
          </Card>
        </Section>
      ) : null}
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card className="border-dashed py-6 text-center text-sm text-muted-foreground shadow-none">{children}</Card>
  );
}

function DetailSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </>
  );
}
