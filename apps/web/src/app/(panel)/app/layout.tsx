import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@granola/ui";

import { OnboardingGate } from "@/components/configuracion/onboarding-gate";
import { BottomNav } from "@/components/panel/bottom-nav";
import { MobileHeader } from "@/components/panel/mobile-header";
import { initialsOf, type PanelUser } from "@/components/panel/nav";
import { Sidebar } from "@/components/panel/sidebar";
import { requireNutritionist } from "@/lib/session";

export const metadata: Metadata = {
  title: "Panel",
  robots: { index: false, follow: false },
};

// requireNutritionist() lee cookies: con cacheComponents debe ir dentro de Suspense.
export default function PanelLayout({ children }: LayoutProps<"/app">) {
  return (
    <Suspense fallback={<PanelShellSkeleton />}>
      <PanelShell>{children}</PanelShell>
    </Suspense>
  );
}

async function PanelShell({ children }: { children: React.ReactNode }) {
  const { nutritionist } = await requireNutritionist();
  const user: PanelUser = {
    name: nutritionist.displayName,
    slug: nutritionist.slug,
    initials: initialsOf(nutritionist.displayName),
    plan: nutritionist.plan,
  };

  return (
    <OnboardingGate step={nutritionist.onboardingStep}>
      <div className="flex min-h-full flex-1">
        <Sidebar user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader user={user} />
          {/* pb extra en móvil para que el contenido no quede bajo la tab bar */}
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-5 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 md:px-8 md:pt-8 md:pb-10">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </OnboardingGate>
  );
}

function PanelShellSkeleton() {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card p-5 md:block">
        <Skeleton className="h-8 w-28" />
      </aside>
      <main className="flex-1 p-6">
        <Skeleton className="h-8 w-48" />
      </main>
    </div>
  );
}
