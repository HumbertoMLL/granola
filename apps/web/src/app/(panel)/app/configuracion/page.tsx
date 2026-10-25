import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@granola/ui";
import { requireNutritionist } from "@/lib/session";
import { PageHeader } from "@/components/panel/page-header";
import { SettingsForms } from "@/components/configuracion/settings-forms";
import { GoogleCalendarCard } from "./google-calendar-card";

export const metadata: Metadata = { title: "Configuración" };
export default function ConfigurationPage() {
  return <Suspense fallback={<Skeleton className="h-40 w-full" />}><Content /></Suspense>;
}
async function Content() {
  const { user, nutritionist } = await requireNutritionist();
  return <div className="flex flex-col gap-6">
    <PageHeader title="Configuración" description="Tu cuenta, preferencias y datos." />
    <SettingsForms name={nutritionist.displayName} email={user.email} timezone={nutritionist.timezone} />
    <GoogleCalendarCard
      connected={Boolean(nutritionist.googleRefreshTokenEnc)}
      configured={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_TOKEN_ENC_KEY)}
    />
  </div>;
}
