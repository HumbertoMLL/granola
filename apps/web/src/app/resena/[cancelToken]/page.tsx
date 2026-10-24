import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalendarClock } from "lucide-react";

import { Button, Card, Skeleton } from "@granola/ui";

import { PublicShell } from "@/components/booking/public-shell";
import { ReviewForm } from "@/components/reviews/review-form";
import { reviewTokenSchema } from "@/components/reviews/review-schema";
import { ReviewThanks } from "@/components/reviews/review-thanks";
import { appointments, db, eq } from "@/lib/db";

export const metadata: Metadata = { title: "Deja tu reseña", robots: { index: false, follow: false } };

type Props = { params: Promise<{ cancelToken: string }> };

/** Destino del botón "Dejar reseña" de la plantilla `pide_resena`. Público: el token es la credencial. */
export default function ResenaPage(props: Props) {
  return (
    <Suspense fallback={<ResenaSkeleton />}>
      <ResenaContent {...props} />
    </Suspense>
  );
}

async function ResenaContent({ params }: Props) {
  await connection();
  const { cancelToken } = await params;
  if (!reviewTokenSchema.safeParse(cancelToken).success) notFound();

  const appt = await db.query.appointments.findFirst({
    where: eq(appointments.cancelToken, cancelToken),
    columns: { status: true },
    with: {
      patient: { columns: { name: true } },
      nutritionist: { columns: { slug: true, displayName: true, avatarUrl: true } },
      reviews: { columns: { id: true }, limit: 1 },
    },
  });
  if (!appt) notFound();

  const nutri = appt.nutritionist;
  const patientFirstName = appt.patient.name.trim().split(/\s+/)[0] ?? appt.patient.name;

  let content: React.ReactNode;
  if (appt.reviews.length > 0) {
    content = <ReviewThanks nutritionistName={nutri.displayName} nutritionistSlug={nutri.slug} variant="already" />;
  } else if (appt.status === "completed") {
    content = (
      <ReviewForm
        token={cancelToken}
        patientFirstName={patientFirstName}
        nutritionistName={nutri.displayName}
        nutritionistSlug={nutri.slug}
      />
    );
  } else {
    const upcoming = appt.status === "confirmed" || appt.status === "pending_payment";
    content = (
      <Card className="items-center gap-4 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          <CalendarClock className="size-7" aria-hidden />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {upcoming ? "Tu cita aún no termina" : "Esta cita no se puede reseñar"}
          </h1>
          <p className="text-muted-foreground">
            {upcoming
              ? `Podrás dejar tu reseña para ${nutri.displayName} cuando termine tu consulta.`
              : "Solo se pueden reseñar consultas que sí se realizaron."}
          </p>
        </div>
        <Button asChild variant="outline" size="lg">
          {upcoming ? (
            <Link href={`/cita/${cancelToken}`}>Ver mi cita</Link>
          ) : (
            <Link href={`/${nutri.slug}`}>Ver la página de {nutri.displayName}</Link>
          )}
        </Button>
      </Card>
    );
  }

  return <PublicShell nutritionist={nutri}>{content}</PublicShell>;
}

function ResenaSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-10">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-13 w-full rounded-full" />
    </div>
  );
}
