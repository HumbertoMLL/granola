import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalendarCheck2, Clock, CreditCard, Landmark, MapPin, MessageCircle, Store, Video } from "lucide-react";

import { Badge, Button, Card, Skeleton } from "@granola/ui";
import { formatDateInTz, formatTimeInTz, timeZoneLabel } from "@granola/core/scheduling";

import { PublicShell } from "@/components/booking/public-shell";
import { STATUS_BADGE_VARIANT, STATUS_LABEL, formatPrice } from "@/components/booking/format";
import { and, appointments, db, desc, eq, payments } from "@/lib/db";
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
  const pagoRaw = Array.isArray(sp.pago) ? sp.pago[0] : sp.pago;
  // ok = volvió de Stripe · pendiente = SPEI/OXXO por pagar · consulta = la nutri aún no cobra en línea.
  const pago = pagoRaw === "ok" || pagoRaw === "pendiente" || pagoRaw === "consulta" ? pagoRaw : null;
  if (!token) notFound();

  const nutri = await getPublicNutritionistBySlug(slug);
  if (!nutri) notFound();

  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.cancelToken, token),
    columns: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      modality: true,
      meetUrl: true,
      nutritionistId: true,
      patientTimezone: true,
    },
    with: {
      service: { columns: { name: true, priceCents: true, currency: true, location: true, paymentMode: true } },
      patient: { columns: { name: true } },
    },
  });
  if (!appt || appt.nutritionistId !== nutri.id) notFound();

  // Hora en la zona del paciente (detectada al agendar); si no la tenemos, la de la nutri.
  const tz = appt.patientTimezone ?? nutri.timezone;
  const showNutriTz = tz !== nutri.timezone;
  const firstName = appt.patient.name.split(/\s+/)[0] ?? appt.patient.name;

  // SPEI/OXXO: el pago pendiente más reciente de la cita (su id es el link a /pago/[id]).
  const pendingPayment =
    pago === "pendiente"
      ? await db.query.payments.findFirst({
          where: and(eq(payments.appointmentId, appt.id), eq(payments.provider, "mercadopago")),
          orderBy: [desc(payments.createdAt)],
          columns: { id: true, method: true, status: true, expiresAt: true, providerData: true },
        })
      : undefined;
  const awaitingPayment = appt.status === "pending_payment";

  return (
    <PublicShell nutritionist={nutri}>
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
          <CalendarCheck2 className="size-8" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {awaitingPayment && pago === "pendiente" ? `Casi listo, ${firstName}` : `¡Listo, ${firstName}!`}
          </h1>
          <p className="text-muted-foreground">
            {awaitingPayment && pago === "pendiente"
              ? `Apartamos tu horario con ${nutri.displayName}. Se confirma en cuanto se acredite tu pago.`
              : awaitingPayment && pago === "ok"
                ? `Recibimos tu pago. Estamos confirmando tu cita con ${nutri.displayName}.`
                : `Tu cita con ${nutri.displayName} quedó agendada.`}
          </p>
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
            {showNutriTz ? (
              <p className="text-xs text-muted-foreground">
                Hora de {nutri.displayName}: {formatTimeInTz(appt.startsAt, nutri.timezone)} (
                {timeZoneLabel(nutri.timezone)})
              </p>
            ) : null}
          </div>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            {appt.modality === "online" ? (
              <>
                <Video className="size-4" /> {appt.meetUrl ? (
                  <a href={appt.meetUrl} className="underline" target="_blank" rel="noreferrer">Entrar a la videollamada</a>
                ) : "En línea · el link te llega antes de la cita"}
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
              {appt.service.paymentMode === "at_visit" || pago === "consulta" ? " · se paga en consulta" : null}
              {pago === "ok" ? " · pagado con tarjeta" : null}
            </p>
          ) : null}
        </Card>

        {pago === "ok" ? (
          <Card className="w-full flex-row items-center gap-3 border-primary/30 bg-primary-soft text-left">
            <CreditCard className="size-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Pago recibido</p>
              <p className="text-sm text-muted-foreground">
                {awaitingPayment
                  ? "Stripe nos está avisando; en unos segundos tu cita aparece como confirmada."
                  : "Tu cita está pagada y confirmada."}
              </p>
            </div>
          </Card>
        ) : null}

        {pago === "pendiente" ? <PendingPaymentCard payment={pendingPayment ?? null} /> : null}

        {pago === "consulta" ? (
          <Card className="w-full gap-1 border-accent/40 bg-accent-soft text-left">
            <p className="font-semibold">Paga en consulta</p>
            <p className="text-sm text-muted-foreground">
              Tu cita ya está confirmada. {nutri.displayName} todavía no activa los pagos en línea, así que el pago
              se hace directamente en la consulta.
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

type PendingPayment = {
  id: string;
  method: "card" | "spei" | "oxxo" | "cash";
  status: "pending" | "paid" | "failed" | "expired" | "refunded";
  expiresAt: Date | null;
  providerData: { ticketUrl?: string | null } | null;
};

function PendingPaymentCard({ payment }: { payment: PendingPayment | null }) {
  if (!payment) {
    return (
      <Card className="w-full gap-1 border-accent/40 bg-accent-soft text-left">
        <p className="font-semibold">Pago pendiente</p>
        <p className="text-sm text-muted-foreground">Te mandamos las instrucciones de pago por WhatsApp.</p>
      </Card>
    );
  }
  if (payment.status === "paid") {
    return (
      <Card className="w-full gap-1 border-primary/30 bg-primary-soft text-left">
        <p className="font-semibold">Pago recibido</p>
        <p className="text-sm text-muted-foreground">Tu cita está confirmada.</p>
      </Card>
    );
  }
  if (payment.status !== "pending") {
    return (
      <Card className="w-full gap-1 border-destructive/30 text-left">
        <p className="font-semibold">El pago venció</p>
        <p className="text-sm text-muted-foreground">El horario se liberó. Puedes agendar de nuevo cuando quieras.</p>
      </Card>
    );
  }
  const isOxxo = payment.method === "oxxo";
  const expires = payment.expiresAt
    ? new Intl.DateTimeFormat("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/Mexico_City",
      }).format(payment.expiresAt)
    : null;
  return (
    <Card className="w-full gap-3 border-accent/40 bg-accent-soft text-left">
      <div className="flex items-center gap-2">
        {isOxxo ? <Store className="size-5 text-[#8a5a0b]" /> : <Landmark className="size-5 text-[#8a5a0b]" />}
        <p className="font-semibold">{isOxxo ? "Paga en OXXO" : "Paga por transferencia SPEI"}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {isOxxo
          ? "Lleva la referencia a cualquier OXXO y paga el monto exacto."
          : "Transfiere desde la app de tu banco a la CLABE que te damos, por el monto exacto."}{" "}
        Te avisamos por WhatsApp en cuanto se acredite.
      </p>
      {expires ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" /> Vence el {expires}
        </p>
      ) : null}
      <Button asChild>
        <Link href={`/pago/${payment.id}`}>{isOxxo ? "Ver referencia de pago" : "Ver CLABE y datos de pago"}</Link>
      </Button>
      {isOxxo && payment.providerData?.ticketUrl ? (
        <Button asChild variant="outline">
          <a href={payment.providerData.ticketUrl} target="_blank" rel="noreferrer">
            Ficha con código de barras
          </a>
        </Button>
      ) : null}
    </Card>
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
