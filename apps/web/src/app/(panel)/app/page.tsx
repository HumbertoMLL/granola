import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@granola/ui";
import {
  AppointmentSection,
  AvailabilityNotice,
  BioLink,
  ConnectionSection,
  DashboardHeader,
  IncomeSection,
  NewPatientsSection,
  NoShowSection,
} from "@/components/dashboard/sections";

export const metadata: Metadata = { title: "Inicio" };

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-20 w-full" />}>
        <DashboardHeader />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-24 w-full" />}>
        <BioLink />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-28 w-full" />}>
        <AvailabilityNotice />
      </Suspense>
      <div className="grid items-start gap-4 md:grid-cols-3">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <IncomeSection />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-44 w-full" />}>
          <NewPatientsSection />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-44 w-full" />}>
          <NoShowSection />
        </Suspense>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <AppointmentSection period="today" />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <AppointmentSection period="week" />
        </Suspense>
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <ConnectionSection />
      </Suspense>
    </div>
  );
}
