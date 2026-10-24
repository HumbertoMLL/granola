import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  CalendarCheck2,
  Clock,
  MessageCircle,
  Star,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage, cn } from "@granola/ui";

import { LinkIcon } from "./link-icon";
import { themeStyle } from "./theme";
import type { PublicProfile, PublicReview, PublicService } from "./types";

type ProfileViewProps = {
  profile: PublicProfile;
  /**
   * Modo vista previa (editor): mismo markup, pero los enlaces no navegan y no
   * se renderiza como página completa (sin min-h-dvh).
   */
  preview?: boolean;
  className?: string;
};

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function formatPrice(cents: number, currency = "MXN"): string {
  if (cents === 0) return "Gratis";
  if (currency === "MXN") return mxn.format(cents / 100);
  return new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(cents / 100);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""))
    .toUpperCase() || "N";
}

const modalityLabel: Record<PublicService["modality"], string> = {
  online: "En línea",
  presencial: "Presencial",
  ambas: "En línea o presencial",
};

export function ProfileView({ profile, preview = false, className }: ProfileViewProps) {
  const { theme } = profile;
  const agendarHref = `/${profile.slug}/agendar`;
  const showReviews = theme.showReviews && profile.reviews.length > 0;
  const showWa = theme.showWhatsApp && !!profile.phoneWa;

  return (
    <div
      data-preset={theme.preset}
      style={themeStyle(theme)}
      className={cn(
        "relative w-full bg-(--pp-bg) font-sans text-(--pp-fg) antialiased",
        preview ? "min-h-full pointer-events-none select-none" : "min-h-dvh",
        className,
      )}
    >
      {/* Glow decorativo del header */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72"
        style={{ background: "var(--pp-glow)" }}
      />

      <div
        className={cn(
          "relative mx-auto flex w-full max-w-md flex-col gap-7 px-5 pb-10",
          preview ? "pt-10" : "pt-[max(2.5rem,env(safe-area-inset-top))]",
        )}
      >
        {/* Header */}
        <header className="flex flex-col items-center text-center">
          <Avatar className="size-24 ring-4 ring-(--pp-surface) shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
            {profile.avatarUrl ? (
              <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
            ) : null}
            <AvatarFallback className="bg-(--pp-primary) text-xl text-(--pp-primary-fg)">
              {initials(profile.displayName)}
            </AvatarFallback>
          </Avatar>

          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{profile.displayName}</h1>

          {profile.cedula ? (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-(--pp-muted)">
              <BadgeCheck className="size-4 text-(--pp-primary)" aria-hidden />
              Céd. prof. {profile.cedula}
            </p>
          ) : null}

          {profile.bio ? (
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-(--pp-muted) whitespace-pre-line">
              {profile.bio}
            </p>
          ) : null}

          {theme.showReviews && profile.reviewStats ? (
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-(--pp-border) bg-(--pp-surface) px-3 py-1 text-xs font-semibold">
              <Star className="size-3.5 fill-(--pp-accent) text-(--pp-accent)" aria-hidden />
              Reseñas verificadas · {profile.reviewStats.average.toFixed(1)} (
              {profile.reviewStats.count})
            </span>
          ) : null}
        </header>

        {/* CTA principal */}
        <div className="flex flex-col gap-2.5">
          <PPButton href={agendarHref} preview={preview} variant="primary">
            <CalendarCheck2 className="size-5" aria-hidden />
            Agendar consulta
          </PPButton>
          {showWa ? (
            <PPButton
              href={`https://wa.me/${profile.phoneWa}`}
              preview={preview}
              variant="outline"
              external
            >
              <MessageCircle className="size-5" aria-hidden />
              Escríbeme por WhatsApp
            </PPButton>
          ) : null}
        </div>

        {/* Links */}
        {profile.links.length > 0 ? (
          <section aria-label="Enlaces" className="flex flex-col gap-2.5">
            {profile.links.map((l) => (
              <PPLink key={l.id} href={l.url} preview={preview} external>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--pp-bg) text-(--pp-primary)">
                  <LinkIcon kind={l.icon} className="size-[18px]" />
                </span>
                <span className="min-w-0 flex-1 truncate text-left font-semibold">{l.label}</span>
                <ArrowUpRight className="size-4 shrink-0 text-(--pp-muted)" aria-hidden />
              </PPLink>
            ))}
          </section>
        ) : null}

        {/* Servicios */}
        {profile.services.length > 0 ? (
          <section className="flex flex-col gap-3">
            <SectionTitle>Servicios</SectionTitle>
            <div className="flex flex-col gap-2.5">
              {profile.services.map((s) => (
                <ServiceCard key={s.id} service={s} slug={profile.slug} preview={preview} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Reseñas */}
        {showReviews ? (
          <section className="flex flex-col gap-3">
            <SectionTitle>Lo que dicen sus pacientes</SectionTitle>
            <div className="flex flex-col gap-2.5">
              {profile.reviews.map((r) => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Footer */}
        <footer className="mt-4 flex flex-col items-center gap-2 text-center text-xs text-(--pp-muted)">
          <PPAnchor
            href="/"
            preview={preview}
            className="inline-flex items-center gap-1.5 rounded-full border border-(--pp-border) bg-(--pp-surface) px-3 py-1.5 font-semibold text-(--pp-fg) transition-opacity hover:opacity-80"
          >
            <span aria-hidden className="inline-block size-2 rounded-full bg-(--pp-primary)" />
            Hecho con Granola
          </PPAnchor>
          <PPAnchor href="/privacidad" preview={preview} className="underline-offset-2 hover:underline">
            Aviso de privacidad
          </PPAnchor>
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-xs font-bold tracking-wider text-(--pp-muted) uppercase">{children}</h2>
  );
}

function ServiceCard({
  service: s,
  slug,
  preview,
}: {
  service: PublicService;
  slug: string;
  preview: boolean;
}) {
  const meta = [
    `${s.durationMin} min`,
    modalityLabel[s.modality],
    s.packageSessions ? `Paquete de ${s.packageSessions}` : null,
  ].filter(Boolean);

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-(--pp-border) bg-(--pp-surface) p-4 shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{s.name}</h3>
          <p className="mt-1 inline-flex flex-wrap items-center gap-x-1.5 text-xs text-(--pp-muted)">
            <Clock className="size-3.5" aria-hidden />
            {meta.join(" · ")}
          </p>
          {s.description ? (
            <p className="mt-2 line-clamp-3 text-sm text-(--pp-muted)">{s.description}</p>
          ) : null}
        </div>
        <p className="shrink-0 text-base font-extrabold">{formatPrice(s.priceCents, s.currency)}</p>
      </div>
      <PPButton
        href={`/${slug}/agendar?servicio=${encodeURIComponent(s.id)}`}
        preview={preview}
        variant="soft"
        size="sm"
      >
        Agendar
      </PPButton>
    </article>
  );
}

function ReviewCard({ review: r }: { review: PublicReview }) {
  return (
    <article className="flex flex-col gap-2 rounded-2xl border border-(--pp-border) bg-(--pp-surface) p-4">
      <div className="flex items-center justify-between gap-2">
        <Stars rating={r.rating} />
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-(--pp-primary)">
          <BadgeCheck className="size-3.5" aria-hidden /> Verificada
        </span>
      </div>
      {r.text ? <p className="text-sm leading-relaxed">{r.text}</p> : null}
      <p className="text-xs text-(--pp-muted)">
        {r.authorName} ·{" "}
        <time dateTime={r.createdAt}>
          {new Date(r.createdAt).toLocaleDateString("es-MX", { month: "short", year: "numeric" })}
        </time>
      </p>
    </article>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            "size-3.5",
            i <= rating ? "fill-(--pp-accent) text-(--pp-accent)" : "text-(--pp-border)",
          )}
        />
      ))}
    </span>
  );
}

/* ---------- Primitivas con el tema (radio de botón configurable) ---------- */

type AnchorProps = {
  href: string;
  preview: boolean;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
};

/** <a>/<Link> que en vista previa no navega. */
function PPAnchor({ href, preview, external, className, children }: AnchorProps) {
  if (preview) {
    return (
      <span className={className} aria-disabled>
        {children}
      </span>
    );
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function PPLink(props: AnchorProps) {
  return (
    <PPAnchor
      {...props}
      className={cn(
        "flex items-center gap-3 rounded-(--pp-radius) border border-(--pp-border) bg-(--pp-surface) p-3 pr-4 text-sm shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-transform hover:-translate-y-px active:scale-[0.99]",
        props.className,
      )}
    />
  );
}

function PPButton({
  variant = "primary",
  size = "md",
  ...props
}: AnchorProps & { variant?: "primary" | "outline" | "soft"; size?: "sm" | "md" }) {
  return (
    <PPAnchor
      {...props}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-(--pp-radius) font-semibold transition-all hover:brightness-95 active:scale-[0.99]",
        size === "md" ? "h-13 px-6 text-base" : "h-10 px-4 text-sm",
        variant === "primary" &&
          "bg-(--pp-primary) text-(--pp-primary-fg) shadow-[0_6px_20px_rgb(0_0_0/0.10)]",
        variant === "outline" && "border border-(--pp-border) bg-(--pp-surface) text-(--pp-fg)",
        variant === "soft" && "bg-(--pp-bg) text-(--pp-primary) ring-1 ring-(--pp-border) ring-inset",
        props.className,
      )}
    />
  );
}
