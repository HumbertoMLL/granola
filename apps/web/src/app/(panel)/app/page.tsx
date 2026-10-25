import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton, SkeletonKPI, SkeletonRow } from "@granola/ui";
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
      <div className="grid grid-cols-2 items-start gap-6 border-b border-border pb-6 sm:grid-cols-3">
        <Suspense fallback={<SkeletonKPI />}>
          <IncomeSection />
        </Suspense>
        <Suspense fallback={<SkeletonKPI />}>
          <NewPatientsSection />
        </Suspense>
        <Suspense fallback={<SkeletonKPI />}>
          <NoShowSection />
        </Suspense>
      </div>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <Suspense fallback={<SkeletonRow />}>
          <AppointmentSection period="today" />
        </Suspense>
        <Suspense fallback={<SkeletonRow />}>
          <AppointmentSection period="week" />
        </Suspense>
      </div>
      <Suspense fallback={<SkeletonRow />}>
        <ConnectionSection />
      </Suspense>
    </div>
  );
}
