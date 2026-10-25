"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  Copy,
  Loader2,
  Share2,
  Smartphone,
} from "lucide-react";

import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
  cn,
  toast,
} from "@granola/ui";

import { PageHeader } from "@/components/panel/page-header";
import type { ResolvedTheme } from "@/components/public-profile/theme";
import {
  BIO_MAX,
  SLUG_MAX,
  normalizeSlug,
  toPublicLinks,
  waDigits,
  type PublicProfile,
  type PublicReview,
  type PublicService,
} from "@/components/public-profile/types";

import { checkSlug, saveMyPage, type SlugStatus } from "./actions";
import { PhonePreview } from "./phone-preview";
import {
  AppearanceEditor,
  AvatarUploader,
  LinksEditor,
  type EditableLink,
} from "./sections";

export type EditorInitial = {
  displayName: string;
  slug: string;
  bio: string;
  cedula: string;
  phoneWa: string;
  avatarUrl: string | null;
  theme: ResolvedTheme;
  links: EditableLink[];
  services: PublicService[];
  reviews: PublicReview[];
  reviewStats: { count: number; average: number } | null;
};

type Draft = Omit<EditorInitial, "services" | "reviews" | "reviewStats">;

type Props = {
  initial: EditorInitial;
  siteUrl: string;
  storageConfigured: boolean;
};

type FieldErrors = Record<string, string[] | undefined>;

function pickDraft(i: EditorInitial): Draft {
  return {
    displayName: i.displayName,
    slug: i.slug,
    bio: i.bio,
    cedula: i.cedula,
    phoneWa: i.phoneWa,
    avatarUrl: i.avatarUrl,
    theme: i.theme,
    links: i.links,
  };
}

export function MyPageEditor({ initial, siteUrl, storageConfigured }: Props) {
  const router = useRouter();
  const [saved, setSaved] = React.useState<Draft>(() => pickDraft(initial));
  const [draft, setDraft] = React.useState<Draft>(saved);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [saving, startSaving] = React.useTransition();
  const [previewOpen, setPreviewOpen] = React.useState(false);
  // Web Share API: false en SSR, real en el cliente (sin setState en effect).
  const canShare = React.useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator.share === "function",
    () => false,
  );

  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  // Aviso al salir con cambios sin guardar.
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const patch = React.useCallback((p: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  /* ----- Slug: disponibilidad en vivo ----- */
  // Solo guardamos el último resultado del server; el estado visible se deriva.
  const [checked, setChecked] = React.useState<{
    slug: string;
    status: SlugStatus;
  } | null>(null);
  const slugStatus: SlugStatus | "checking" | null =
    draft.slug === saved.slug
      ? null
      : draft.slug.length < 3
        ? "invalid"
        : checked?.slug === draft.slug
          ? checked.status
          : "checking";

  React.useEffect(() => {
    if (draft.slug === saved.slug || draft.slug.length < 3) return;
    let cancelled = false;
    const slug = draft.slug;
    const t = setTimeout(async () => {
      try {
        const status = await checkSlug(slug);
        if (!cancelled) setChecked({ slug, status });
      } catch {
        if (!cancelled) setChecked(null);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [draft.slug, saved.slug]);

  /* ----- Vista previa ----- */
  const previewProfile = React.useMemo<PublicProfile>(
    () => ({
      slug: draft.slug || "tu-link",
      displayName: draft.displayName.trim() || "Tu nombre",
      bio: draft.bio.trim() || null,
      avatarUrl: draft.avatarUrl,
      cedula: draft.cedula.trim() || null,
      phoneWa: draft.theme.showWhatsApp ? waDigits(draft.phoneWa) : null,
      theme: draft.theme,
      links: toPublicLinks(draft.links),
      services: initial.services,
      reviews: initial.reviews,
      reviewStats: initial.reviewStats,
    }),
    [draft, initial.services, initial.reviews, initial.reviewStats],
  );

  /* ----- Guardar ----- */
  function save() {
    if (
      slugStatus === "taken" ||
      slugStatus === "reserved" ||
      slugStatus === "invalid"
    ) {
      setErrors((e) => ({ ...e, slug: ["Elige otro link"] }));
      toast.error("Ese link no está disponible");
      return;
    }
    startSaving(async () => {
      const res = await saveMyPage(draft);
      if (res.ok) {
        const next = { ...draft, slug: res.slug };
        setSaved(next);
        setDraft(next);
        setErrors({});
        toast.success("Cambios guardados", {
          description: `${siteUrl.replace(/^https?:\/\//, "")}/${res.slug}`,
        });
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
      }
    });
  }

  function discard() {
    setDraft(saved);
    setErrors({});
  }

  /* ----- Copiar / compartir ----- */
  const publicUrl = `${siteUrl}/${saved.slug}`;
  const prettyUrl = publicUrl.replace(/^https?:\/\//, "");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link copiado", { description: prettyUrl });
    } catch {
      toast.error("No se pudo copiar. Selecciona el link y cópialo a mano.");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: `${saved.displayName} · Agenda tu consulta`,
        text: "Agenda tu consulta conmigo aquí:",
        url: publicUrl,
      });
    } catch (err) {
      // El usuario canceló: no es error.
      if (err instanceof Error && err.name === "AbortError") return;
      void copyLink();
    }
  }

  const slugHint = slugStatusHint(slugStatus, errors.slug?.[0]);
  const hasPhone = !!waDigits(draft.phoneWa);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Mi página"
        description="Lo que ven tus pacientes cuando entran a tu link."
      >
        <Button type="button" variant="outline" size="sm" onClick={copyLink}>
          <Copy /> Copiar link
        </Button>
        {canShare ? (
          <Button type="button" variant="outline" size="sm" onClick={share}>
            <Share2 /> Compartir
          </Button>
        ) : null}
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${saved.slug}`} target="_blank" rel="noopener">
            Ver página <ArrowUpRight />
          </Link>
        </Button>
      </PageHeader>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------ Form ------------------------------ */}
        <form
          className="flex min-w-0 flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {/* Perfil */}
          <Card className="gap-5">
            <CardHeader>
              <CardTitle>Perfil</CardTitle>
              <CardDescription>
                Tu nombre, tu link y cómo te presentas.
              </CardDescription>
            </CardHeader>

            <AvatarUploader
              name={draft.displayName}
              avatarUrl={draft.avatarUrl}
              storageConfigured={storageConfigured}
              onUploaded={(url) => {
                // La subida ya quedó guardada en la DB: sincronizamos ambos estados.
                setSaved((s) => ({ ...s, avatarUrl: url }));
                setDraft((d) => ({ ...d, avatarUrl: url }));
              }}
              onRemove={() => patch({ avatarUrl: null })}
            />

            <Field
              label="Nombre que se muestra"
              htmlFor="displayName"
              error={errors.displayName?.[0]}
            >
              <Input
                id="displayName"
                value={draft.displayName}
                maxLength={60}
                autoComplete="name"
                aria-invalid={!!errors.displayName}
                onChange={(e) => patch({ displayName: e.target.value })}
              />
            </Field>

            <Field
              label="Tu link"
              htmlFor="slug"
              error={slugHint.tone === "error" ? slugHint.text : undefined}
              hint={slugHint.tone !== "error" ? slugHint.text : undefined}
              hintTone={slugHint.tone}
            >
              <div className="flex items-center overflow-hidden rounded-xl border border-input bg-card focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25">
                <span className="shrink-0 pl-4 text-sm text-muted-foreground select-none">
                  {prettyUrl.split("/")[0]}/@
                </span>
                <input
                  id="slug"
                  value={draft.slug}
                  maxLength={SLUG_MAX}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-invalid={slugHint.tone === "error"}
                  className="h-11 min-w-0 flex-1 bg-transparent pr-3 pl-0.5 text-base outline-none md:text-sm"
                  onChange={(e) =>
                    patch({ slug: normalizeSlug(e.target.value) })
                  }
                />
                <span className="flex w-10 shrink-0 items-center justify-center">
                  {slugStatus === "checking" ? (
                    <Loader2
                      className="size-4 animate-spin text-muted-foreground"
                      aria-hidden
                    />
                  ) : slugStatus === "ok" ? (
                    <Check className="size-4 text-primary" aria-hidden />
                  ) : slugHint.tone === "error" ? (
                    <CircleAlert
                      className="size-4 text-destructive"
                      aria-hidden
                    />
                  ) : null}
                </span>
              </div>
            </Field>

            <Field
              label="Bio"
              htmlFor="bio"
              error={errors.bio?.[0]}
              hint={`${draft.bio.length}/${BIO_MAX}`}
              hintTone={draft.bio.length > BIO_MAX ? "error" : "muted"}
            >
              <Textarea
                id="bio"
                value={draft.bio}
                maxLength={BIO_MAX}
                placeholder="Qué haces, para quién y cómo trabajas. Dos o tres líneas."
                aria-invalid={!!errors.bio}
                onChange={(e) => patch({ bio: e.target.value })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Cédula profesional"
                htmlFor="cedula"
                error={errors.cedula?.[0]}
                hint="Opcional. Se muestra con una palomita."
              >
                <Input
                  id="cedula"
                  value={draft.cedula}
                  inputMode="numeric"
                  maxLength={20}
                  placeholder="12345678"
                  aria-invalid={!!errors.cedula}
                  onChange={(e) => patch({ cedula: e.target.value })}
                />
              </Field>
              <Field
                label="WhatsApp"
                htmlFor="phoneWa"
                error={errors.phoneWa?.[0]}
                hint="Escribe tu número de WhatsApp de México."
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-11 items-center rounded-xl border border-border px-3 text-sm">
                    +52
                  </span>
                  <Input
                    id="phoneWa"
                    value={draft.phoneWa.replace(/^\+52/, "")}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="55 1234 5678"
                    aria-invalid={!!errors.phoneWa}
                    onChange={(e) =>
                      patch({
                        phoneWa: e.target.value ? `+52${e.target.value}` : "",
                      })
                    }
                  />
                </div>
              </Field>
            </div>
          </Card>

          {/* Links */}
          <Card className="gap-5">
            <CardHeader>
              <CardTitle>Links</CardTitle>
              <CardDescription>
                Tus redes y lo que quieras destacar. El orden aquí es el orden
                en tu página.
              </CardDescription>
            </CardHeader>
            <LinksEditor
              links={draft.links}
              onChange={(links) => patch({ links })}
              errors={errors.links}
            />
          </Card>

          {/* Apariencia */}
          <Card className="gap-5">
            <CardHeader>
              <CardTitle>Apariencia</CardTitle>
              <CardDescription>
                Colores y forma de los botones. Se aplica a toda tu página.
              </CardDescription>
            </CardHeader>
            <AppearanceEditor
              theme={draft.theme}
              hasPhone={hasPhone}
              onChange={(theme) => patch({ theme })}
            />
          </Card>

          {/* Barra de guardado (pegajosa; en móvil queda sobre la tab bar) */}
          <div
            className={cn(
              "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/95 p-3 shadow-float backdrop-blur-md transition-all md:bottom-4",
              dirty
                ? "translate-y-0 opacity-100"
                : "pointer-events-none translate-y-2 opacity-0 lg:pointer-events-auto lg:translate-y-0 lg:opacity-100",
            )}
            aria-live="polite"
          >
            <p className="hidden min-w-0 truncate pl-1 text-sm text-muted-foreground sm:block">
              {dirty ? "Tienes cambios sin guardar" : "Todo guardado"}
            </p>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial lg:hidden"
                onClick={() => setPreviewOpen(true)}
              >
                <Smartphone /> Vista previa
              </Button>
              {dirty ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1 sm:flex-initial"
                  onClick={discard}
                  disabled={saving}
                >
                  Descartar
                </Button>
              ) : null}
              <Button
                type="submit"
                size="sm"
                className="flex-1 sm:flex-initial"
                loading={saving}
                disabled={!dirty}
              >
                Guardar
              </Button>
            </div>
          </div>
        </form>

        {/* --------------------------- Preview (desktop) --------------------------- */}
        <aside className="sticky top-6 hidden lg:block">
          <p className="mb-3 text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Vista previa en vivo
          </p>
          <PhonePreview profile={previewProfile} />
        </aside>
      </div>

      {/* --------------------------- Preview (móvil) --------------------------- */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="bottom" className="items-center gap-3">
          <SheetHeader className="items-center text-center">
            <SheetTitle>Vista previa</SheetTitle>
            <SheetDescription>
              Así ve tu página una paciente desde su celular.
            </SheetDescription>
          </SheetHeader>
          <PhonePreview profile={previewProfile} className="max-h-[70dvh]" />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function noopSubscribe() {
  return () => {};
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  hintTone = "muted",
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  hintTone?: "muted" | "ok" | "error";
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p
          className={cn(
            "text-xs",
            hintTone === "ok" && "text-primary",
            hintTone === "error" && "text-destructive",
            hintTone === "muted" && "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function slugStatusHint(
  status: SlugStatus | "checking" | null,
  serverError?: string,
): { text: string; tone: "muted" | "ok" | "error" } {
  if (serverError) return { text: serverError, tone: "error" };
  switch (status) {
    case "ok":
      return { text: "Disponible", tone: "ok" };
    case "taken":
      return { text: "Ya está en uso", tone: "error" };
    case "reserved":
      return { text: "Ese link está reservado", tone: "error" };
    case "invalid":
      return {
        text: "Mínimo 3 caracteres: letras, números y guiones",
        tone: "error",
      };
    case "checking":
      return { text: "Verificando disponibilidad…", tone: "muted" };
    default:
      return {
        text: "Es el que compartes en tu bio de Instagram y TikTok.",
        tone: "muted",
      };
  }
}
