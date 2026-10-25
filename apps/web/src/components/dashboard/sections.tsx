import "server-only";

import { cache } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays } from "lucide-react";
import { Badge, Button, EmptyState, KPI, SectionHeader } from "@granola/ui";
import { formatTimeInTz } from "@granola/core/scheduling";
import { PageHeader } from "@/components/panel/page-header";
import { CopyButton } from "@/components/cobros/copy-button";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
  formatCalendarDate,
} from "@/components/booking/format";
import {
  getDashboardIncome,
  getDashboardNewPatients,
  getDashboardNoShows,
  getDashboardPreviousMonth,
  hasDashboardAvailability,
  listDashboardAppointments,
} from "@/lib/dashboard";
import { requireNutritionist } from "@/lib/session";
import { formatDashboardMoney, groupAppointments } from "./aggregation";

const context = cache(async () => {
  const { nutritionist } = await requireNutritionist();
  return { nutritionist, now: new Date() };
});
const comparison = cache(async () => {
  const { nutritionist, now } = await context();
  return getDashboardPreviousMonth(nutritionist.id, now, nutritionist.timezone);
});
const number = (value: number) =>
  new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value);
const delta = (current: number, previous: number) =>
  previous === 0
    ? current === 0
      ? "Sin cambios vs mes anterior"
      : `${number(current)} vs mes anterior`
    : `${number(((current - previous) / previous) * 100)}% vs mes anterior`;

export async function DashboardHeader() {
  const { nutritionist, now } = await context();
  return (
    <PageHeader
      className="hidden md:flex"
      title={`Hola, ${nutritionist.displayName.split(" ")[0]}`}
      description={new Intl.DateTimeFormat("es-MX", {
        month: "long",
        timeZone: nutritionist.timezone,
      }).format(now)}
    >
      <Button asChild variant="outline" size="sm">
        <Link href={`/${nutritionist.slug}`} target="_blank" rel="noreferrer">
          Ver mi página <ArrowUpRight />
        </Link>
      </Button>
    </PageHeader>
  );
}
export async function BioLink() {
  const { nutritionist } = await context();
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border pb-4 text-sm">
      <a
        href={`/${nutritionist.slug}`}
        className="min-w-0 truncate text-muted-foreground hover:text-primary"
      >
        granola.app/@{nutritionist.slug}
      </a>
      <CopyButton
        value={`${process.env.NEXT_PUBLIC_APP_URL ?? "https://granola.app"}/${nutritionist.slug}`}
      />
    </div>
  );
}
export async function AvailabilityNotice() {
  const { nutritionist, now } = await context();
  if (
    await hasDashboardAvailability(nutritionist.id, now, nutritionist.timezone)
  )
    return null;
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-l-[3px] border-status-pending bg-secondary p-4"
      role="status"
    >
      <p className="text-sm">Configura tus horarios para recibir reservas.</p>
      <Button asChild variant="outline" size="sm">
        <Link href="/app/agenda?tab=disponibilidad">Configurar horarios</Link>
      </Button>
    </div>
  );
}
export async function AppointmentSection({
  period,
}: {
  period: "today" | "week";
}) {
  const { nutritionist, now } = await context();
  const rows = await listDashboardAppointments(
    nutritionist.id,
    now,
    nutritionist.timezone,
    period,
  );
  const groups = groupAppointments(rows, nutritionist.timezone);
  return (
    <section className="space-y-4">
      <SectionHeader
        title={
          <>
            {period === "today" ? "Hoy" : "Esta semana"}{" "}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {rows.length}
            </span>
          </>
        }
        actions={
          <Link
            href="/app/agenda"
            className="text-sm text-primary hover:underline"
          >
            Ver agenda
          </Link>
        }
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title={period === "today" ? "Sin citas hoy" : "Sin citas esta semana"}
          action={
            <Link
              href="/app/agenda?tab=disponibilidad"
              className="text-sm text-primary hover:underline"
            >
              Revisar horarios
            </Link>
          }
        />
      ) : (
        groups.map((group) => (
          <div key={group.date}>
            {period === "week" ? (
              <h3 className="mb-2 text-sm text-muted-foreground">
                {formatCalendarDate(group.date)}
              </h3>
            ) : null}
            <ul className="divide-y divide-border border-y border-border">
              {group.appointments.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/app/agenda/${row.id}`}
                    className="flex min-h-16 items-center justify-between gap-3 py-3 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">
                        {row.patientName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        <time dateTime={row.startsAt.toISOString()}>
                          {formatTimeInTz(row.startsAt, nutritionist.timezone)}
                        </time>{" "}
                        · {row.serviceName}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE_VARIANT[row.status]}>
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
export async function IncomeSection() {
  const { nutritionist, now } = await context();
  const [income, previous] = await Promise.all([
    getDashboardIncome(nutritionist.id, now, nutritionist.timezone),
    comparison(),
  ]);
  const currencies = income.length
    ? income
    : [{ currency: "MXN", totalCents: 0 }];
  return (
    <div className="col-span-2 space-y-4 sm:col-span-1">
      {currencies.map((summary) => (
        <KPI
          key={summary.currency}
          label={`Ingresos · ${summary.currency}`}
          value={formatDashboardMoney(summary.totalCents, summary.currency)}
          delta={`${formatDashboardMoney(summary.totalCents - (previous.income.find((row) => row.currency === summary.currency)?.totalCents ?? 0), summary.currency)} vs mes anterior`}
        />
      ))}
    </div>
  );
}
export async function NewPatientsSection() {
  const { nutritionist, now } = await context();
  const [total, previous] = await Promise.all([
    getDashboardNewPatients(nutritionist.id, now, nutritionist.timezone),
    comparison(),
  ]);
  return (
    <KPI
      label="Pacientes nuevos"
      value={total}
      delta={delta(total, previous.newPatients)}
    />
  );
}
export async function NoShowSection() {
  const { nutritionist, now } = await context();
  const [rate, previous] = await Promise.all([
    getDashboardNoShows(nutritionist.id, now, nutritionist.timezone),
    comparison(),
  ]);
  return (
    <KPI
      label="Ausencias"
      value={
        rate.percent === null
          ? "—"
          : `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(rate.percent)}%`
      }
      delta={
        rate.percent === null || previous.noShows.percent === null
          ? "Sin referencia anterior"
          : `${number(rate.percent - previous.noShows.percent)} pp vs mes anterior`
      }
    />
  );
}
export async function ConnectionSection() {
  const { nutritionist } = await context();
  const connected = Boolean(nutritionist.stripeAccountId);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">
        {connected
          ? nutritionist.stripeChargesEnabled
            ? "Cobros con tarjeta activos"
            : "Stripe · Requisitos pendientes"
          : "Stripe sin conectar"}
      </p>
      <Button asChild variant="ghost" size="sm">
        <Link href="/app/cobros">
          {connected ? "Revisar cobros" : "Conectar Stripe"}
        </Link>
      </Button>
    </div>
  );
}
