import type { Metadata } from "next";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";

import { Button, Skeleton } from "@granola/ui";

import { AgendaTabs, type AgendaData } from "@/components/agenda/agenda-tabs";
import { PageHeader } from "@/components/panel/page-header";
import {
  and,
  appointments,
  availabilityOverrides,
  availabilityRules,
  db,
  eq,
  gte,
  services,
} from "@/lib/db";
import { requireNutritionist } from "@/lib/session";

export const metadata: Metadata = { title: "Agenda" };

/** Cuántos días hacia atrás se listan citas pasadas. */
const PAST_DAYS = 30;

export default function AgendaPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<AgendaSkeleton />}>
        <AgendaContent />
      </Suspense>
    </div>
  );
}

async function AgendaContent() {
  const { nutritionist } = await requireNutritionist();
  const now = new Date();
  const since = new Date(now.getTime() - PAST_DAYS * 86_400_000);

  const [apptRows, serviceRows, ruleRows, overrideRows] = await Promise.all([
    db.query.appointments.findMany({
      where: and(
        eq(appointments.nutritionistId, nutritionist.id),
        gte(appointments.endsAt, since),
      ),
      orderBy: (a, { asc }) => [asc(a.startsAt)],
      with: {
        patient: { columns: { name: true, phoneWa: true } },
        service: { columns: { name: true, durationMin: true } },
      },
    }),
    db.query.services.findMany({
      where: eq(services.nutritionistId, nutritionist.id),
      orderBy: (s, { asc }) => [asc(s.sortOrder), asc(s.createdAt)],
    }),
    db.query.availabilityRules.findMany({
      where: eq(availabilityRules.nutritionistId, nutritionist.id),
      orderBy: (r, { asc }) => [asc(r.weekday), asc(r.startTime)],
    }),
    db.query.availabilityOverrides.findMany({
      where: eq(availabilityOverrides.nutritionistId, nutritionist.id),
      orderBy: (o, { asc }) => [asc(o.date)],
    }),
  ]);

  const data: AgendaData = {
    slug: nutritionist.slug,
    timezone: nutritionist.timezone,
    scheduling: {
      bufferMin: nutritionist.bufferMin,
      minNoticeMin: nutritionist.minNoticeMin,
      slotStepMin: nutritionist.slotStepMin,
    },
    nowIso: now.toISOString(),
    appointments: apptRows.map((a) => ({
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      endsAt: a.endsAt.toISOString(),
      status: a.status,
      modality: a.modality,
      meetUrl: a.meetUrl,
      patientName: a.patient.name,
      patientPhone: a.patient.phoneWa,
      serviceName: a.service.name,
      durationMin: a.service.durationMin,
    })),
    services: serviceRows.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      priceCents: s.priceCents,
      currency: s.currency,
      modality: s.modality,
      location: s.location,
      isActive: s.isActive,
      paymentMode: s.paymentMode,
      sortOrder: s.sortOrder,
    })),
    rules: ruleRows.map((r) => ({
      id: r.id,
      weekday: r.weekday,
      startTime: r.startTime,
      endTime: r.endTime,
    })),
    overrides: overrideRows.map((o) => ({
      id: o.id,
      date: o.date,
      startTime: o.startTime,
      endTime: o.endTime,
      isBlocked: o.isBlocked,
    })),
  };

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Tus citas, servicios y disponibilidad."
      >
        <Button
          size="sm"
          variant="outline"
          className="hidden sm:inline-flex"
          asChild
        >
          <a
            href={`/${nutritionist.slug}/agendar`}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink /> Ver mi página de citas
          </a>
        </Button>
      </PageHeader>
      <AgendaTabs data={data} />
    </>
  );
}

function AgendaSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-11 w-full rounded-full sm:w-96" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    </>
  );
}
