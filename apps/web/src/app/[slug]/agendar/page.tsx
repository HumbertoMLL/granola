import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Skeleton } from "@granola/ui";

import { BookingFlow } from "@/components/booking/booking-flow";
import { PublicShell } from "@/components/booking/public-shell";
import { getActiveServices, getPublicNutritionistBySlug } from "@/lib/booking";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ servicio?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Agendar con @${slug}`, robots: { index: false } };
}

// Lee DB en cada request (sin prerender): todo va dentro de Suspense + connection().
export default function AgendarPage(props: Props) {
  return (
    <Suspense fallback={<AgendarSkeleton />}>
      <AgendarContent {...props} />
    </Suspense>
  );
}

async function AgendarContent({ params, searchParams }: Props) {
  await connection();
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const nutri = await getPublicNutritionistBySlug(slug);
  if (!nutri) notFound();

  const services = await getActiveServices(nutri.id);
  const servicio = Array.isArray(sp.servicio) ? sp.servicio[0] : sp.servicio;

  return (
    <PublicShell nutritionist={nutri}>
      <BookingFlow
        slug={nutri.slug}
        nutritionistTimezone={nutri.timezone}
        services={services}
        nowIso={new Date().toISOString()}
        initialServiceId={servicio}
      />
    </PublicShell>
  );
}

function AgendarSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-6 w-64" />
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  );
}
