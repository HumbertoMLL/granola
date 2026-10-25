import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@granola/ui";
import { requireNutritionist } from "@/lib/session";
import { PageHeader } from "@/components/panel/page-header";
import { SettingsForms } from "@/components/configuracion/settings-forms";

export const metadata: Metadata = { title: "Configuración" };
export default function ConfigurationPage() {
  return <Suspense fallback={<Skeleton className="h-40 w-full" />}><Content /></Suspense>;
}
async function Content() {
  const { user, nutritionist } = await requireNutritionist();
  const theme: Record<string, unknown> = { ...nutritionist.theme };
  return <div className="flex flex-col gap-6">
    <PageHeader title="Configuración" description="Tu cuenta, preferencias y datos." />
    <SettingsForms name={nutritionist.displayName} email={user.email} timezone={nutritionist.timezone} notifyNewBooking={theme.notifyNewBooking !== false} />
  </div>;
}
