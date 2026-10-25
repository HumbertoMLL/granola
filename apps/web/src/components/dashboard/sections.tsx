import "server-only";

import { cache } from "react";
import Link from "next/link";
import { ArrowUpRight, Copy } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@granola/ui";
import {
  formatTimeInTz,
  formatYmdLong,
  ymdInTz,
} from "@granola/core/scheduling";
import { PageHeader } from "@/components/panel/page-header";
import {
  STATUS_BADGE_VARIANT,
  STATUS_LABEL,
} from "@/components/booking/format";
import {
  getDashboardIncome,
  getDashboardNewPatients,
  getDashboardNoShows,
  hasDashboardAvailability,
  listDashboardAppointments,
} from "@/lib/dashboard";
import { requireNutritionist } from "@/lib/session";
import { formatDashboardMoney, groupAppointments } from "./aggregation";

// Compartir sesión y reloj solo durante este render, sin cachear datos entre nutris.
const context = cache(async () => {
  const { nutritionist } = await requireNutritionist();
  return { nutritionist, now: new Date() };
});

export async function DashboardHeader() {
  const { nutritionist } = await context();
  return (
    <PageHeader
      title={`Hola, ${nutritionist.displayName.split(" ")[0]}`}
      description="Esto es lo que tienes hoy."
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
    <Card className="flex-row items-center justify-between gap-4 bg-primary-soft/60 p-4 sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wider text-primary uppercase">
          Tu link para la bio
        </p>
        <p className="truncate font-semibold">
          granola.app/@{nutritionist.slug}
        </p>
      </div>
      <Button size="sm" variant="outline" className="shrink-0" disabled>
        <Copy /> Copiar
      </Button>
    </Card>
  );
}

export async function AvailabilityNotice() {
  const { nutritionist, now } = await context();
  if (
    await hasDashboardAvailability(nutritionist.id, now, nutritionist.timezone)
  )
    return null;
  return (
    <Card className="gap-2 border-accent p-4" role="status">
      <p className="font-semibold">Configura tu disponibilidad</p>
      <p className="text-sm text-muted-foreground">
        Agrega tus horarios para empezar a recibir reservas.
      </p>
      <Button asChild variant="outline" size="sm" className="self-start">
        <Link href="/app/agenda?tab=disponibilidad">Configurar horarios</Link>
      </Button>
    </Card>
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
    <Card>
      <CardHeader>
        <CardTitle>
          {period === "today" ? "Citas de hoy" : "Próximos 7 días"}{" "}
          <Badge variant="secondary">{rows.length}</Badge>
        </CardTitle>
        <CardDescription>
          {period === "today"
            ? formatYmdLong(ymdInTz(now, nutritionist.timezone))
            : "Desde mañana · citas confirmadas y pendientes de pago"}{" "}
          · {nutritionist.timezone}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {period === "today"
              ? "Sin citas hoy."
              : "Sin citas en los próximos 7 días."}
          </p>
        ) : (
          groups.map((group) => (
            <section key={group.date} className="flex flex-col gap-2">
              {period === "week" ? (
                <h3 className="text-sm font-semibold">
                  {formatYmdLong(group.date)}
                </h3>
              ) : null}
              <ul className="divide-y divide-border">
                {group.appointments.map((row) => (
                  <li key={row.id} className="py-3 first:pt-0">
                    <Link
                      href={`/app/agenda/${row.id}`}
                      className="flex flex-col gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-primary sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">
                          <time dateTime={row.startsAt.toISOString()}>
                            {formatTimeInTz(
                              row.startsAt,
                              nutritionist.timezone,
                            )}
                          </time>{" "}
                          · {row.patientName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {row.serviceName}
                        </p>
                      </div>
                      <Badge
                        className="self-start shrink-0"
                        variant={STATUS_BADGE_VARIANT[row.status]}
                      >
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}

const METHOD_LABEL = {
  card: "Tarjeta",
  spei: "SPEI",
  oxxo: "OXXO",
  cash: "Efectivo",
} as const;

export async function IncomeSection() {
  const { nutritionist, now } = await context();
  const income = await getDashboardIncome(
    nutritionist.id,
    now,
    nutritionist.timezone,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresos del mes</CardTitle>
        <CardDescription>Pagos acreditados en tu zona horaria</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {income.length === 0 ? (
          <>
            <p className="text-3xl font-extrabold">{formatDashboardMoney(0)}</p>
            <p className="text-sm text-muted-foreground">
              Aún no hay pagos acreditados este mes.
            </p>
          </>
        ) : (
          income.map((summary) => (
            <div key={summary.currency}>
              <p className="text-3xl font-extrabold tabular-nums">
                {formatDashboardMoney(summary.totalCents, summary.currency)}{" "}
                <span className="text-sm font-normal">{summary.currency}</span>
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {(
                  Object.keys(METHOD_LABEL) as (keyof typeof METHOD_LABEL)[]
                ).map((method) => (
                  <div key={method}>
                    <dt className="text-muted-foreground">
                      {METHOD_LABEL[method]}
                    </dt>
                    <dd className="font-semibold tabular-nums">
                      {formatDashboardMoney(
                        summary.methods[method],
                        summary.currency,
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))
        )}
        <Link
          href="/app/cobros"
          className="text-sm font-semibold text-primary underline"
        >
          Ver cobros
        </Link>
      </CardContent>
    </Card>
  );
}

export async function NewPatientsSection() {
  const { nutritionist, now } = await context();
  const total = await getDashboardNewPatients(
    nutritionist.id,
    now,
    nutritionist.timezone,
  );
  return (
    <Card>
      <CardHeader>
        <CardDescription>Pacientes nuevos del mes</CardDescription>
        <CardTitle className="text-3xl font-extrabold tabular-nums">
          {total}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Registrados este mes en tu zona horaria.
      </CardContent>
    </Card>
  );
}

export async function NoShowSection() {
  const { nutritionist, now } = await context();
  const rate = await getDashboardNoShows(
    nutritionist.id,
    now,
    nutritionist.timezone,
  );
  return (
    <Card>
      <CardHeader>
        <CardDescription>Tasa de no-show del mes</CardDescription>
        <CardTitle className="text-3xl font-extrabold tabular-nums">
          {rate.percent === null
            ? "—"
            : `${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(rate.percent)}%`}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {rate.total === 0
          ? "Sin citas con asistencia registrada este mes."
          : `${rate.noShows} ${rate.noShows === 1 ? "ausencia" : "ausencias"} de ${rate.total} ${rate.total === 1 ? "cita" : "citas"} con asistencia registrada.`}{" "}
        Se calcula sobre citas completadas y ausencias; excluye canceladas y
        pendientes.
      </CardContent>
    </Card>
  );
}

export async function ConnectionSection() {
  const { nutritionist } = await context();
  const connected = Boolean(nutritionist.stripeAccountId);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Conexión de cobros</CardTitle>
        <CardDescription>Stripe</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <Badge variant={connected ? "default" : "secondary"}>
          {connected ? "Stripe conectado" : "Stripe sin conectar"}
        </Badge>
        <p className="text-sm text-muted-foreground">
          {connected
            ? nutritionist.stripeChargesEnabled
              ? "Tu cuenta está habilitada para recibir pagos."
              : "Tu cuenta está vinculada. Revisa los requisitos para habilitar cobros."
            : "Conecta tu cuenta para recibir pagos con tarjeta."}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/app/cobros">
            {connected ? "Revisar cobros" : "Conectar Stripe"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
