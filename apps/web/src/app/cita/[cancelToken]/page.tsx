import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Card, Skeleton } from "@granola/ui";

import {
  ManageAppointment,
  type ManageAppointmentData,
} from "@/components/booking/manage-appointment";
import { Logo } from "@/components/logo";
import { PublicShell } from "@/components/booking/public-shell";
import { appointments, db, eq } from "@/lib/db";

export const metadata: Metadata = {
  title: "Tu cita",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ cancelToken: string }> };

/** Mismo umbral que en actions.ts. */
const PATIENT_CHANGE_MIN_HOURS = 2;

export default function CitaPage(props: Props) {
  return (
    <Suspense fallback={<CitaSkeleton />}>
      <CitaContent {...props} />
    </Suspense>
  );
}

async function CitaContent({ params }: Props) {
  await connection();
  const { cancelToken } = await params;
  if (!cancelToken || cancelToken.length < 16 || cancelToken.length > 64)
    notFound();

  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.cancelToken, cancelToken),
    columns: {
      startsAt: true,
      endsAt: true,
      status: true,
      modality: true,
      meetUrl: true,
    },
    with: {
      service: { columns: { name: true, location: true } },
      patient: { columns: { name: true } },
      nutritionist: {
        columns: {
          slug: true,
          displayName: true,
          avatarUrl: true,
          timezone: true,
        },
      },
    },
  });
  if (!appt) notFound();

  const now = new Date();
  const data: ManageAppointmentData = {
    token: cancelToken,
    startsAt: appt.startsAt.toISOString(),
    endsAt: appt.endsAt.toISOString(),
    status: appt.status,
    modality: appt.modality,
    serviceName: appt.service.name,
    location: appt.service.location,
    meetUrl: appt.meetUrl,
    patientFirstName: appt.patient.name.split(/\s+/)[0] ?? appt.patient.name,
    nutritionistName: appt.nutritionist.displayName,
    nutritionistSlug: appt.nutritionist.slug,
    nutritionistTimezone: appt.nutritionist.timezone,
    canChange:
      appt.startsAt.getTime() - now.getTime() >=
      PATIENT_CHANGE_MIN_HOURS * 3_600_000,
    nowIso: now.toISOString(),
  };

  return (
    <PublicShell nutritionist={appt.nutritionist} compact>
      <Card className="gap-6 p-6 md:p-8">
        <Logo size={24} />
        <ManageAppointment data={data} />
      </Card>
    </PublicShell>
  );
}

function CitaSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-[400px] flex-col gap-4 px-4 py-8">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-12 w-full rounded-md" />
    </div>
  );
}
