import Link from "next/link";
import { BadgeCheck, ChevronRight, Star } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  buttonVariants,
  cn,
} from "@granola/ui";
import {
  formatPrice as price,
  formatShortDate,
} from "@/components/booking/format";

import { LinkIcon } from "./link-icon";
import { themeStyle } from "./theme";
import type { PublicProfile, PublicReview, PublicService } from "./types";

type ProfileViewProps = {
  profile: PublicProfile;
  /** El editor usa el mismo markup, sin navegación ni altura de página. */
  preview?: boolean;
  className?: string;
  nextAvailable?: React.ReactNode;
};

export const formatPrice = price;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (
      (parts[0]?.[0] ?? "") +
      (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")
    ).toUpperCase() || "N"
  );
}

const modalityLabel: Record<PublicService["modality"], string> = {
  online: "En línea",
  presencial: "Presencial",
  ambas: "En línea o presencial",
};

export function ProfileView({
  profile,
  preview = false,
  className,
  nextAvailable,
}: ProfileViewProps) {
  const { theme } = profile;
  const showReviews = theme.showReviews && profile.reviews.length > 0;
  const showWa = theme.showWhatsApp && !!profile.phoneWa;

  return (
    <div
      data-preset={theme.preset}
      style={themeStyle(theme)}
      className={cn(
        "w-full bg-(--pp-bg) font-sans text-(--pp-fg) antialiased",
        preview ? "min-h-full pointer-events-none select-none" : "min-h-dvh",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-[560px] flex-col gap-8 px-5 pb-8",
          preview ? "pt-8" : "pt-[max(2rem,env(safe-area-inset-top))] sm:pt-12",
        )}
      >
        <header className="flex flex-col items-center text-center">
          <Avatar className="size-24">
            {profile.avatarUrl ? (
              <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
            ) : null}
            <AvatarFallback className="bg-(--pp-secondary) text-xl text-(--pp-fg)">
              {initials(profile.displayName)}
            </AvatarFallback>
          </Avatar>
          <h1 className="mt-4 font-display text-[32px] leading-[1.2] tracking-tight">
            {profile.displayName}
          </h1>
          {profile.cedula ? (
            <p className="mt-2 text-sm text-(--pp-muted)">
              Cédula profesional {profile.cedula}
            </p>
          ) : null}
          {theme.showReviews && profile.reviewStats ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-(--pp-muted)">
              <Star
                className="size-4 fill-current text-(--pp-fg)"
                aria-hidden
              />
              <span>
                <span className="font-medium text-(--pp-fg)">
                  {profile.reviewStats.average.toFixed(1)}
                </span>{" "}
                · {profile.reviewStats.count}{" "}
                {profile.reviewStats.count === 1
                  ? "reseña verificada"
                  : "reseñas verificadas"}
              </span>
            </p>
          ) : null}
          {profile.bio ? (
            <p className="mt-4 max-w-md text-base leading-normal text-(--pp-muted) whitespace-pre-line">
              {profile.bio}
            </p>
          ) : null}
        </header>

        <div className="flex flex-col gap-3">
          <PPButton href={`/${profile.slug}/agendar`} preview={preview}>
            Agendar consulta
          </PPButton>
          {nextAvailable ??
            (preview ? (
              <p className="text-center text-sm text-(--pp-muted)">
                El próximo horario disponible aparecerá aquí.
              </p>
            ) : null)}
          {showWa ? (
            <PPButton
              href={`https://wa.me/${profile.phoneWa}`}
              preview={preview}
              variant="outline"
              external
            >
              Escríbeme por WhatsApp
            </PPButton>
          ) : null}
        </div>

        {profile.services.length > 0 ? (
          <section
            aria-labelledby={preview ? "preview-services" : "profile-services"}
          >
            <SectionTitle
              id={preview ? "preview-services" : "profile-services"}
            >
              Servicios
            </SectionTitle>
            <ul className="mt-3 divide-y divide-(--pp-border) border-y border-(--pp-border)">
              {profile.services.map((service) => (
                <li key={service.id}>
                  <ServiceRow
                    service={service}
                    slug={profile.slug}
                    preview={preview}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {showReviews ? (
          <section
            aria-labelledby={preview ? "preview-reviews" : "profile-reviews"}
          >
            <SectionTitle id={preview ? "preview-reviews" : "profile-reviews"}>
              Reseñas
            </SectionTitle>
            <div className="mt-4 flex flex-col gap-6">
              {profile.reviews.map((review) => (
                <ReviewQuote key={review.id} review={review} />
              ))}
            </div>
          </section>
        ) : null}

        {profile.links.length > 0 ? (
          <nav
            aria-label="Enlaces"
            className="flex flex-wrap justify-center gap-3 border-t border-(--pp-border) pt-6"
          >
            {profile.links.map((link) => (
              <PPAnchor
                key={link.id}
                href={link.url}
                preview={preview}
                external
                label={link.label}
                className="inline-flex size-12 items-center justify-center rounded-md text-(--pp-muted) transition-colors hover:bg-(--pp-secondary) hover:text-(--pp-fg) focus-visible:outline-(--pp-primary)"
              >
                <LinkIcon kind={link.icon} className="size-5" />
                <span className="sr-only">{link.label}</span>
              </PPAnchor>
            ))}
          </nav>
        ) : null}

        <footer className="flex items-center justify-center gap-3 text-center text-xs text-(--pp-muted)">
          <PPAnchor href="/" preview={preview} className="py-3 hover:underline">
            Hecho con Granola
          </PPAnchor>
          <span aria-hidden>·</span>
          <PPAnchor
            href="/privacidad"
            preview={preview}
            className="py-3 hover:underline"
          >
            Aviso de privacidad
          </PPAnchor>
        </footer>
      </div>
    </div>
  );
}

function SectionTitle({
  children,
  id,
}: {
  children: React.ReactNode;
  id: string;
}) {
  return (
    <h2 id={id} className="text-lg font-semibold text-(--pp-fg)">
      {children}
    </h2>
  );
}

function ServiceRow({
  service,
  slug,
  preview,
}: {
  service: PublicService;
  slug: string;
  preview: boolean;
}) {
  const meta = [
    `${service.durationMin} min`,
    modalityLabel[service.modality],
    service.packageSessions ? `${service.packageSessions} sesiones` : null,
  ].filter(Boolean);
  return (
    <PPAnchor
      href={`/${slug}/agendar?paso=2&servicio=${encodeURIComponent(service.id)}`}
      preview={preview}
      className="group flex min-h-16 items-center gap-3 py-4 transition-colors hover:text-(--pp-primary) focus-visible:outline-(--pp-primary)"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">{service.name}</span>
        <span className="mt-1 block text-sm text-(--pp-muted)">
          {meta.join(" · ")}
        </span>
      </span>
      <span className="shrink-0 text-base font-medium tabular-nums">
        {formatPrice(service.priceCents, service.currency)}
      </span>
      <ChevronRight className="size-4 shrink-0 text-(--pp-muted)" aria-hidden />
    </PPAnchor>
  );
}

function ReviewQuote({ review }: { review: PublicReview }) {
  return (
    <figure className="border-l border-(--pp-border) pl-4">
      <div className="mb-2 flex items-center gap-3">
        <Stars rating={review.rating} />
        <span className="inline-flex items-center gap-1 text-xs text-(--pp-muted)">
          <BadgeCheck className="size-3" aria-hidden />
          Verificada
        </span>
      </div>
      {review.text ? (
        <blockquote className="text-base leading-normal">
          “{review.text}”
        </blockquote>
      ) : null}
      <figcaption className="mt-3 text-sm text-(--pp-muted)">
        {review.authorName} ·{" "}
        <time dateTime={review.createdAt}>
          {formatShortDate(
            new Date(review.createdAt),
            "America/Mexico_City",
            new Date(),
            { weekday: false, relative: false },
          )}
        </time>
      </figcaption>
    </figure>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="inline-flex gap-1 text-(--pp-fg)"
      role="img"
      aria-label={`${rating} de 5 estrellas`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn("size-3", i <= rating ? "fill-current" : "opacity-25")}
        />
      ))}
    </span>
  );
}

type AnchorProps = {
  href: string;
  preview: boolean;
  external?: boolean;
  className?: string;
  children: React.ReactNode;
  label?: string;
};
function PPAnchor({
  href,
  preview,
  external,
  className,
  children,
  label,
}: AnchorProps) {
  if (preview)
    return (
      <span className={className} aria-disabled title={label}>
        {children}
      </span>
    );
  if (external)
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        title={label}
      >
        {children}
      </a>
    );
  return (
    <Link href={href} className={className} title={label}>
      {children}
    </Link>
  );
}
function PPButton({
  variant = "primary",
  ...props
}: AnchorProps & { variant?: "primary" | "outline" }) {
  return (
    <PPAnchor
      {...props}
      className={cn(
        buttonVariants({ variant, size: "lg" }),
        "w-full focus-visible:ring-(--pp-primary)",
        variant === "primary"
          ? "h-13 rounded-full bg-(--pp-booking-primary) text-(--pp-booking-fg) hover:bg-(--pp-primary-hover)"
          : "border-(--pp-border) text-(--pp-fg) hover:bg-(--pp-secondary)",
        props.className,
      )}
    />
  );
}
