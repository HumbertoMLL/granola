import { ImageResponse } from "next/og";

import { PRESETS } from "@/components/public-profile/theme";
import { initials } from "@/components/public-profile/profile-view";
import { getPublicProfile, isReservedSlug } from "@/lib/public-profile";

export const alt = "Agenda tu consulta";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = isReservedSlug(slug) ? null : await getPublicProfile(slug);

  const t = PRESETS[profile?.theme.preset ?? "avena"];
  const name = profile?.displayName ?? "Granola";
  const subtitle = profile ? "Agenda tu consulta" : "La agenda que te llena la consulta";
  const cedula = profile?.cedula ? `Céd. prof. ${profile.cedula}` : null;
  const stats = profile?.reviewStats
    ? `★ ${profile.reviewStats.average.toFixed(1)} · ${profile.reviewStats.count} reseñas verificadas`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: t.bg,
          color: t.fg,
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -200,
            width: 900,
            height: 500,
            borderRadius: 9999,
            background: t.primary,
            opacity: 0.12,
            filter: "blur(40px)",
          }}
        />
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt=""
            width={180}
            height={180}
            style={{
              borderRadius: 9999,
              objectFit: "cover",
              border: `8px solid ${t.surface}`,
            }}
          />
        ) : (
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 9999,
              background: t.primary,
              color: t.primaryFg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 72,
              fontWeight: 800,
              border: `8px solid ${t.surface}`,
            }}
          >
            {initials(name)}
          </div>
        )}
        <div style={{ marginTop: 36, fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>{name}</div>
        {cedula ? (
          <div style={{ marginTop: 8, fontSize: 26, color: t.muted }}>{cedula}</div>
        ) : null}
        <div
          style={{
            marginTop: 32,
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: t.primary,
            color: t.primaryFg,
            borderRadius: 9999,
            padding: "18px 44px",
            fontSize: 32,
            fontWeight: 700,
          }}
        >
          {subtitle}
        </div>
        {stats ? (
          <div style={{ marginTop: 22, fontSize: 24, color: t.muted }}>{stats}</div>
        ) : null}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 22,
            color: t.muted,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: 9999, background: t.primary }} />
          granola.app/@{profile?.slug ?? ""}
        </div>
      </div>
    ),
    { ...size },
  );
}
