import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Skeleton, SkeletonRow } from "@granola/ui";

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
    <div
      role="status"
      aria-label="Cargando reserva"
      className="mx-auto w-full max-w-[480px] space-y-6 px-5 py-6"
    >
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-1 w-full" />
      <Skeleton className="h-6 w-64" />
      <SkeletonRow avatar={false} />
      <SkeletonRow avatar={false} />
    </div>
  );
}
