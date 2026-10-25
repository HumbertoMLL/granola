import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@granola/ui";

import { BottomNav } from "@/components/panel/bottom-nav";
import { MobileHeader } from "@/components/panel/mobile-header";
import { initialsOf, type PanelUser } from "@/components/panel/nav";
import { Sidebar } from "@/components/panel/sidebar";
import { enforceOnboarding } from "@/lib/onboarding-gate";
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
  // Gate server-side: redirige al wizard mientras onboarding_step < 4.
  const { onOnboardingRoute } = await enforceOnboarding(nutritionist.onboardingStep);
  if (onOnboardingRoute) {
    // El wizard va sin sidebar ni tab bar: sin enlaces que esquiven el gate.
    return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-10">{children}</main>;
  }
  const user: PanelUser = {
    name: nutritionist.displayName,
    slug: nutritionist.slug,
    initials: initialsOf(nutritionist.displayName),
    plan: nutritionist.plan,
  };

  return (
    <div className="flex min-h-full flex-1">
        <Sidebar user={user} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileHeader user={user} />
          {/* pb extra en móvil para que el contenido no quede bajo la tab bar */}
          <main className="mx-auto w-full max-w-[1184px] flex-1 px-4 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 md:pb-12">
            {children}
          </main>
        </div>
        <BottomNav />
    </div>
  );
}

function PanelShellSkeleton() {
  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-[240px] shrink-0 border-r border-border bg-background p-8 md:block">
        <Skeleton className="h-8 w-28" />
      </aside>
      <main className="flex-1 p-6">
        <Skeleton className="h-8 w-48" />
      </main>
    </div>
  );
}
