import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfileView } from "@/components/public-profile/profile-view";
import { getPublicProfile, isReservedSlug } from "@/lib/public-profile";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.BETTER_AUTH_URL ?? "https://granola.app";

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const profile = isReservedSlug(slug) ? null : await getPublicProfile(slug);
  if (!profile) return { title: "Página no encontrada", robots: { index: false } };

  const title = `${profile.displayName} · Agenda tu consulta`;
  const description =
    profile.bio?.slice(0, 160) ??
    `Agenda tu consulta de nutrición con ${profile.displayName}. Reservas en línea y confirmación por WhatsApp.`;
  const url = `${SITE_URL}/${profile.slug}`;

  return {
    title: { absolute: title },
    description,
    metadataBase: new URL(SITE_URL),
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      locale: "es_MX",
      url,
      title,
      description,
      siteName: "Granola",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

// La página es pública y la indexan buscadores: preferimos un 404 real (status)
// a un shell estático que luego pinta "no encontrada" con 200. Por eso leemos
// `params` fuera de <Suspense> y desactivamos la validación de navegación instantánea.
export const instant = false;

export default async function PublicProfilePage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  if (isReservedSlug(slug)) notFound();

  const profile = await getPublicProfile(slug);
  if (!profile) notFound();

  return <ProfileView profile={profile} />;
}
