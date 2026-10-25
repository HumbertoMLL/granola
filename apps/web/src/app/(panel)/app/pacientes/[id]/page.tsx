import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PatientRecord } from "@/components/patients/patient-record";
export const metadata: Metadata = { title: "Expediente" };
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ appointmentId?: string }> };
export default function PatientPage(props: Props) {
  return (
    <Suspense fallback={<p>Cargando expediente…</p>}>
      <Content {...props} />
    </Suspense>
  );
}
async function Content({ params, searchParams }: Props) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const query = z.object({ appointmentId: z.uuid().optional() }).safeParse(await searchParams);
  if (!query.success) notFound();
  return <PatientRecord patientId={id} appointmentId={query.data.appointmentId} />;
}
