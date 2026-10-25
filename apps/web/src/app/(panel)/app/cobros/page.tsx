import type { Metadata } from "next";
import { Suspense } from "react";
import {
  Badge,
  KPI,
  SectionHeader,
  Skeleton,
  SkeletonKPI,
  SkeletonRow,
} from "@granola/ui";
import {
  accountStatusFromColumns,
  isMercadoPagoConfigured,
  isStripeConfigured,
  listPaymentsForMonth,
  listUnpaidVisitAppointments,
  summarizeMonth,
} from "@granola/payments";

import { PageHeader } from "@/components/panel/page-header";
import {
  currentMonth,
  formatDateTime,
  formatMoney,
  monthLabel,
  monthOffsetMinutes,
  recentMonths,
} from "@/components/cobros/format";
import { MarkCashPaidButton } from "@/components/cobros/mark-cash-paid-button";
import { MonthFilter } from "@/components/cobros/month-filter";
import { PaymentsTable } from "@/components/cobros/payments-table";
import {
  StripeConnectCard,
  type StripeCardState,
} from "@/components/cobros/stripe-connect-card";
import { requireNutritionist } from "@/lib/session";

export const metadata: Metadata = { title: "Cobros" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Con `cacheComponents` todo lo que lee cookies (sesión) o searchParams va
 * dentro de Suspense; el shell estático (header + explicación) se sirve al instante.
 */
export default function CobrosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cobros">
        <span className="text-sm text-muted-foreground">
          Comisión Granola{" "}
          <span className="font-medium text-foreground">0%</span> · MXN
        </span>
      </PageHeader>

      <Suspense fallback={<SummarySkeleton />}>
        <SummaryAndTable searchParams={searchParams} />
      </Suspense>

      <section className="grid gap-4 border-t border-border pt-6">
        <SectionHeader title="Métodos de cobro" />
        <div className="grid gap-6 md:grid-cols-2">
          <Suspense fallback={<Skeleton className="h-52" />}>
            <StripeSection searchParams={searchParams} />
          </Suspense>
          <MercadoPagoCard />
        </div>
      </section>

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

async function SummaryAndTable({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { nutritionist } = await requireNutritionist();
  const tz = nutritionist.timezone;
  const { month, months, offset } = await resolveMonth(searchParams, tz);

  const [summary, items] = await Promise.all([
    summarizeMonth(nutritionist.id, month, { timezoneOffsetMinutes: offset }),
    listPaymentsForMonth(nutritionist.id, month, {
      timezoneOffsetMinutes: offset,
    }),
  ]);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{monthLabel(month)}</h2>
        <MonthFilter months={months} value={month} />
      </div>

      <div className="grid grid-cols-3 gap-4 border-y border-border py-6 md:gap-6">
        <KPI
          label="Cobrado"
          value={formatMoney(summary.paidCents)}
          delta={`${summary.paidCount} ${summary.paidCount === 1 ? "pago" : "pagos"}`}
        />
        <KPI
          label="Por acreditar"
          value={formatMoney(summary.pendingCents)}
          delta={`${summary.pendingCount} pendientes`}
        />
        <KPI
          label="En consulta"
          value={summary.cashCount}
          delta={
            summary.cashCount === 1 ? "pago en efectivo" : "pagos en efectivo"
          }
        />
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeader title="Historial" />
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
        <SkeletonKPI />
        <SkeletonKPI />
        <SkeletonKPI />
      </div>
      <SkeletonRow />
      <SkeletonRow />
    </>
  );
}

// ───────────── Stripe ─────────────

async function StripeSection({ searchParams }: { searchParams: SearchParams }) {
  const [{ nutritionist }, sp] = await Promise.all([
    requireNutritionist(),
    searchParams,
  ]);
  const justReturned = sp.stripe === "return";

  // Flags persistidos (webhook `account.updated` / botón "Actualizar estado"):
  // el render no llama a Stripe.
  let state: StripeCardState;
  if (!isStripeConfigured()) {
    state = { kind: "not_configured" };
  } else if (!nutritionist.stripeAccountId) {
    state = { kind: "disconnected" };
  } else {
    const s = accountStatusFromColumns({
      stripeAccountId: nutritionist.stripeAccountId,
      stripeChargesEnabled: nutritionist.stripeChargesEnabled,
      stripePayoutsEnabled: nutritionist.stripePayoutsEnabled,
      stripeRequirements: nutritionist.stripeRequirements,
    });
    state = {
      kind: "connected",
      chargesEnabled: s.chargesEnabled,
      payoutsEnabled: s.payoutsEnabled,
      detailsSubmitted: s.detailsSubmitted,
      currentlyDue: s.currentlyDue,
      pastDue: s.pastDue,
      disabledReason: s.disabledReason,
      syncedAt: s.syncedAt,
    };
  }

  return <StripeConnectCard state={state} justReturned={justReturned} />;
}

// ───────────── Mercado Pago (cuenta Granola) ─────────────

function MercadoPagoCard() {
  const configured = isMercadoPagoConfigured();
  return (
    <section className="flex flex-col items-start gap-3">
      <div className="flex w-full items-center justify-between gap-3">
        <h3 className="font-semibold">SPEI y OXXO</h3>
        <Badge variant={configured ? "confirmed" : "done"}>
          {configured ? "Disponible" : "No disponible"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Transferencia o efectivo en OXXO, a través de Granola.
      </p>
      <details className="text-sm">
        <summary className="w-fit cursor-pointer text-muted-foreground">
          Tiempos de acreditación
        </summary>
        <ul className="mt-3 grid gap-2 text-muted-foreground">
          <li>SPEI: referencia válida 24 h. Se acredita en minutos.</li>
          <li>OXXO: referencia válida 48 h. Se acredita en 1–2 h hábiles.</li>
        </ul>
      </details>
    </section>
  );
}

// ───────────── Efectivo ─────────────

async function CashSection({ searchParams }: { searchParams: SearchParams }) {
  const { nutritionist } = await requireNutritionist();
  const tz = nutritionist.timezone;
  const { month, offset } = await resolveMonth(searchParams, tz);
  const unpaid = await listUnpaidVisitAppointments(nutritionist.id, month, {
    timezoneOffsetMinutes: offset,
  });

  return (
    <section className="grid gap-3 border-t border-border pt-6">
      <SectionHeader title="Cobros en consulta" />
      <div>
        {unpaid.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nada pendiente. Todo registrado.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {unpaid.map((a) => (
              <li
                key={a.appointmentId}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.patientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {a.serviceName} · {formatDateTime(a.startsAt, tz)} ·{" "}
                    {formatMoney(a.priceCents, a.currency)}
                  </p>
                </div>
                <MarkCashPaidButton
                  appointmentId={a.appointmentId}
                  amountCents={a.priceCents}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
