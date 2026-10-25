import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Card, Skeleton } from "@granola/ui";

import { requireNutritionist } from "@/lib/session";

import { PendingDeletionActions } from "./pending-deletion-actions";

export const metadata: Metadata = { title: "Tu cuenta se eliminará", robots: { index: false, follow: false } };

/**
 * Única pantalla de una cuenta con borrado pendiente (ADR 0015). Vive fuera de
 * /app porque el layout del panel exige cuenta activa (requireNutritionist redirige aquí).
 */
export default function PendingDeletionPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-4 py-12">
      <Suspense fallback={<Skeleton className="h-48 w-full" />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  const { nutritionist } = await requireNutritionist({ allowPendingDeletion: true });
  if (!nutritionist.deletedAt) redirect("/app");

  const scheduledFor = nutritionist.deletionScheduledFor;
  const expired = isGraceOver(nutritionist);
  const date = scheduledFor
    ? new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeZone: nutritionist.timezone }).format(scheduledFor)
    : null;

  return (
    <Card className="gap-4">
      <h1 className="text-2xl font-semibold">
        {expired ? "Tu cuenta fue eliminada" : `Tu cuenta se eliminará el ${date}`}
      </h1>
      {expired ? (
        <p className="text-muted-foreground">El periodo de 30 días terminó y ya no se puede recuperar.</p>
      ) : (
        <>
          <p className="text-muted-foreground">
            Mientras tanto tu página pública no se ve y no puedes usar el panel. Si cambiaste de opinión, cancela la
            eliminación y todo vuelve a como estaba.
          </p>
          <p className="text-sm text-muted-foreground">
            Las citas que se cancelaron al pedir la eliminación no se restauran: tus pacientes ya recibieron el aviso.
          </p>
        </>
      )}
      <PendingDeletionActions canCancel={!expired} />
    </Card>
  );
}

/** La gracia venció (o ya corrió el purge): ya no se puede cancelar. */
function isGraceOver(n: { purgedAt: Date | null; deletionScheduledFor: Date | null }): boolean {
  return Boolean(n.purgedAt) || !n.deletionScheduledFor || n.deletionScheduledFor.getTime() <= Date.now();
}
