import type { Metadata } from "next";
import { Suspense } from "react";
import { Landmark, Store } from "lucide-react";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@granola/ui";
import {
  getAccountStatus,
  isMercadoPagoConfigured,
  isStripeConfigured,
  listPaymentsForMonth,
  listUnpaidVisitAppointments,
  PaymentsNotConfiguredError,
  summarizeMonth,
} from "@granola/payments";

import { PageHeader } from "@/components/panel/page-header";
import { currentMonth, formatDateTime, formatMoney, monthLabel, monthOffsetMinutes, recentMonths } from "@/components/cobros/format";
import { MarkCashPaidButton } from "@/components/cobros/mark-cash-paid-button";
import { MonthFilter } from "@/components/cobros/month-filter";
import { PaymentsTable } from "@/components/cobros/payments-table";
import { StripeConnectCard, type StripeCardState } from "@/components/cobros/stripe-connect-card";
import { requireNutritionist } from "@/lib/session";

export const metadata: Metadata = { title: "Cobros" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Con `cacheComponents` todo lo que lee cookies (sesión) o searchParams va
 * dentro de Suspense; el shell estático (header + explicación) se sirve al instante.
 */
export default function CobrosPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cobros" description="Lo que te pagan tus pacientes, sin comisión.">
        <Badge>Comisión Granola: 0%</Badge>
      </PageHeader>

      <Suspense fallback={<SummarySkeleton />}>
        <SummaryAndTable searchParams={searchParams} />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-52" />}>
          <StripeSection searchParams={searchParams} />
        </Suspense>
        <MercadoPagoCard />
      </div>

      <Suspense fallback={<Skeleton className="h-32" />}>
        <CashSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// ───────────── helpers de mes ─────────────

async function resolveMonth(searchParams: SearchParams, timeZone: string) {
  const sp = await searchParams;
  const raw = typeof sp.mes === "string" ? sp.mes : undefined;
  const months = recentMonths(timeZone);
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonth(timeZone);
  if (!months.includes(month)) months.push(month);
  return { month, months, offset: monthOffsetMinutes(month, timeZone) };
}

// ───────────── resumen + tabla ─────────────

async function SummaryAndTable({ searchParams }: { searchParams: SearchParams }) {
  const { nutritionist } = await requireNutritionist();
  const tz = nutritionist.timezone;
  const { month, months, offset } = await resolveMonth(searchParams, tz);

  const [summary, items] = await Promise.all([
    summarizeMonth(nutritionist.id, month, { timezoneOffsetMinutes: offset }),
    listPaymentsForMonth(nutritionist.id, month, { timezoneOffsetMinutes: offset }),
  ]);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{monthLabel(month)}</p>
        <MonthFilter months={months} value={month} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Cobrado este mes</CardDescription>
            <CardTitle className="text-3xl font-extrabold tabular-nums">{formatMoney(summary.paidCents)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {summary.paidCount} {summary.paidCount === 1 ? "pago" : "pagos"} · comisión Granola $0
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pendientes (SPEI / OXXO)</CardDescription>
            <CardTitle className="text-3xl font-extrabold tabular-nums">{summary.pendingCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {formatMoney(summary.pendingCents)} esperando acreditarse
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pagos en consulta</CardDescription>
            <CardTitle className="text-3xl font-extrabold tabular-nums">{summary.cashCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">Cobrados en efectivo y registrados aquí.</CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Historial</h2>
        <PaymentsTable items={items} timeZone={tz} />
      </section>
    </>
  );
}

function SummarySkeleton() {
  return (
    <>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-40" />
    </>
  );
}

// ───────────── Stripe ─────────────

async function StripeSection({ searchParams }: { searchParams: SearchParams }) {
  const [{ nutritionist }, sp] = await Promise.all([requireNutritionist(), searchParams]);
  const justReturned = sp.stripe === "return";

  let state: StripeCardState;
  if (!isStripeConfigured()) {
    state = { kind: "not_configured" };
  } else if (!nutritionist.stripeAccountId) {
    state = { kind: "disconnected" };
  } else {
    try {
      const s = await getAccountStatus(nutritionist.stripeAccountId);
      state = {
        kind: "connected",
        chargesEnabled: s.chargesEnabled,
        payoutsEnabled: s.payoutsEnabled,
        detailsSubmitted: s.detailsSubmitted,
        currentlyDue: s.currentlyDue,
        pastDue: s.pastDue,
        disabledReason: s.disabledReason,
      };
    } catch (err) {
      state = {
        kind: "error",
        message:
          err instanceof PaymentsNotConfiguredError
            ? err.message
            : "No pudimos consultar tu cuenta de Stripe. Intenta más tarde.",
      };
    }
  }

  return <StripeConnectCard state={state} justReturned={justReturned} />;
}

// ───────────── Mercado Pago (cuenta Granola) ─────────────

function MercadoPagoCard() {
  const configured = isMercadoPagoConfigured();
  return (
    <Card className="gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-[#8a5a0b]">
          <Store className="size-5" />
        </div>
        <Badge variant={configured ? "default" : "secondary"}>{configured ? "Incluido" : "No disponible"}</Badge>
      </div>
      <div>
        <p className="font-semibold">SPEI y OXXO vía Granola</p>
        <p className="text-sm text-muted-foreground">
          Para pacientes sin tarjeta. No tienes que abrir ninguna cuenta: el paciente transfiere por SPEI
          o paga en OXXO a Granola, la cita se confirma al acreditarse y te lo depositamos.
        </p>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Landmark className="size-4" /> SPEI: la CLABE vence a las 24 h; se acredita en minutos.
        </li>
        <li className="flex items-center gap-2">
          <Store className="size-4" /> OXXO: la ficha vence a las 48 h; se acredita en 1–2 h hábiles.
        </li>
      </ul>
      {!configured ? (
        <p className="text-sm text-muted-foreground">
          Mercado Pago no está configurado en este entorno (falta <code>MP_ACCESS_TOKEN</code>).
        </p>
      ) : null}
    </Card>
  );
}

// ───────────── Efectivo ─────────────

async function CashSection({ searchParams }: { searchParams: SearchParams }) {
  const { nutritionist } = await requireNutritionist();
  const tz = nutritionist.timezone;
  const { month, offset } = await resolveMonth(searchParams, tz);
  const unpaid = await listUnpaidVisitAppointments(nutritionist.id, month, { timezoneOffsetMinutes: offset });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobros en consulta</CardTitle>
        <CardDescription>
          Citas de {monthLabel(month).toLowerCase()} con pago en consulta que aún no registraste.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unpaid.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nada pendiente. Todo registrado.</p>
        ) : (
          <ul className="divide-y divide-border">
            {unpaid.map((a) => (
              <li key={a.appointmentId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.patientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.serviceName} · {formatDateTime(a.startsAt, tz)} · {formatMoney(a.priceCents, a.currency)}
                  </p>
                </div>
                <MarkCashPaidButton appointmentId={a.appointmentId} amountCents={a.priceCents} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
