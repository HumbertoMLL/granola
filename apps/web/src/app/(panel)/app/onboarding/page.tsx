import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@granola/ui";
import { db, eq, availabilityRules } from "@/lib/db";
import { requireNutritionist } from "@/lib/session";
import { OnboardingWizard } from "@/components/configuracion/onboarding-wizard";

export const metadata: Metadata = { title: "Bienvenida a Granola" };
export default function OnboardingPage() {
  return <Suspense fallback={<Skeleton className="h-64 w-full" />}><Content /></Suspense>;
}
async function Content() {
  const { nutritionist: n } = await requireNutritionist();
  if (n.onboardingStep >= 4) redirect("/app");
  const rules = await db.select({ weekday: availabilityRules.weekday, startTime: availabilityRules.startTime, endTime: availabilityRules.endTime }).from(availabilityRules).where(eq(availabilityRules.nutritionistId, n.id));
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "https://granola.app").replace(/\/+$/, "");
  return <OnboardingWizard key={n.onboardingStep} step={n.onboardingStep} displayName={n.displayName} slug={n.slug} rules={rules.map((r) => ({ ...r, startTime: r.startTime.slice(0, 5), endTime: r.endTime.slice(0, 5) }))} timezone={n.timezone} siteUrl={siteUrl} />;
}
