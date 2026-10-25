import type { Metadata } from "next";
import { Suspense } from "react";

import { Skeleton } from "@granola/ui";

import { toPublicLinks } from "@/components/public-profile/types";
import { resolveTheme } from "@/components/public-profile/theme";
import { getPublicProfile } from "@/lib/public-profile";
import { isStorageConfigured } from "@/lib/storage";
import { requireNutritionist } from "@/lib/session";

import { MyPageEditor, type EditorInitial } from "./editor";

export const metadata: Metadata = { title: "Mi página" };

export default function MiPaginaPage() {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <MiPaginaPageContent />
    </Suspense>
  );
}

async function MiPaginaPageContent() {
  const { nutritionist: n } = await requireNutritionist();

  // Servicios y reseñas reales para que la vista previa sea fiel. Vienen del mismo
  // loader cacheado que usa /[slug]; el editor lo invalida al guardar (updateTag).
  const pub = await getPublicProfile(n.slug);

  const rawLinks = Array.isArray(n.links) ? n.links : [];
  const initial: EditorInitial = {
    displayName: n.displayName,
    slug: n.slug,
    bio: n.bio ?? "",
    cedula: n.cedula ?? "",
    phoneWa: n.phoneWa ?? "",
    avatarUrl: n.avatarUrl,
    theme: resolveTheme(n.theme),
    links: rawLinks.map((l, i) => ({
      id: l.id ?? `link-${i}`,
      label: l.label ?? "",
      url: l.url ?? "",
      icon: toPublicLinks([{ ...l, visible: true }])[0]?.icon ?? "otro",
      visible: l.visible !== false,
    })),
    services: pub?.services ?? [],
    reviews: pub?.reviews ?? [],
    reviewStats: pub?.reviewStats ?? null,
  };

  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "https://granola.app";

  return (
    <MyPageEditor
      initial={initial}
      siteUrl={siteUrl.replace(/\/+$/, "")}
      storageConfigured={isStorageConfigured()}
    />
  );
}

function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-56" />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <Skeleton className="hidden h-[640px] w-full rounded-xl lg:block" />
      </div>
    </div>
  );
}
