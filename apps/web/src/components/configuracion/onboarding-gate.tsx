"use client";

import { redirect, usePathname } from "next/navigation";

/** El layout persiste entre navegaciones; pathname mantiene activa la redirección. */
export function OnboardingGate({ step, children }: { step: number; children: React.ReactNode }) {
  const pathname = usePathname();
  if (step < 4 && pathname !== "/app/onboarding") redirect("/app/onboarding");
  return children;
}
