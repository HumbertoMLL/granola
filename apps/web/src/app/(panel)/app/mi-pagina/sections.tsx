"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImagePlus,
  Plus,
  Trash2,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
  toast,
} from "@granola/ui";

import { LinkIcon } from "@/components/public-profile/link-icon";
import { initials } from "@/components/public-profile/profile-view";
import {
  BUTTON_RADIUS,
  BUTTON_STYLES,
  BUTTON_STYLE_LABELS,
  LINK_ICONS,
  LINK_ICON_LABELS,
  PRESETS,
  THEME_PRESETS,
  type LinkIcon as LinkIconKind,
  type ResolvedTheme,
} from "@/components/public-profile/theme";

import { uploadAvatar } from "./actions";

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

type AvatarUploaderProps = {
  name: string;
  avatarUrl: string | null;
  storageConfigured: boolean;
  onUploaded: (url: string) => void;
  onRemove: () => void;
};

const AVATAR_SIZE = 512;

/** Redimensiona en el navegador a 512×512 (recorte centrado) JPEG. */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))),
      "image/jpeg",
      0.86,
    );
  });
}

export function AvatarUploader({
  name,
  avatarUrl,
  storageConfigured,
  onUploaded,
  onRemove,
}: AvatarUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [pending, setPending] = React.useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Elige una imagen (JPG, PNG o WebP)");
      return;
    }
    setPending(true);
    try {
      const blob = await resizeImage(file);
      const fd = new FormData();
      fd.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const res = await uploadAvatar(fd);
      if (res.ok) {
        onUploaded(res.url);
        toast.success("Foto actualizada");
      } else {
        toast.error(res.error);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la foto");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20 ring-2 ring-border">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-xl">{initials(name || "N")}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFile}
            disabled={!storageConfigured || pending}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={pending}
            disabled={!storageConfigured}
            onClick={() => inputRef.current?.click()}
          >
            {!pending ? <ImagePlus /> : null}
            {avatarUrl ? "Cambiar foto" : "Subir foto"}
          </Button>
          {avatarUrl ? (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={pending}>
              Quitar
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {storageConfigured
            ? "Cuadrada, mínimo 400 px. La recortamos y optimizamos por ti."
            : "Configura R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET) para subir fotos."}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Links                                                               */
/* ------------------------------------------------------------------ */

export type EditableLink = {
  id: string;
  label: string;
  url: string;
  icon: LinkIconKind;
  visible: boolean;
};

export function newLinkId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

/** Adivina el ícono a partir del dominio para no hacer elegir a la nutri. */
export function guessIcon(url: string): LinkIconKind | null {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("wa.me") || u.includes("whatsapp.com")) return "whatsapp";
  return null;
}

type LinksEditorProps = {
  links: EditableLink[];
  onChange: (links: EditableLink[]) => void;
  errors?: string[];
};

export function LinksEditor({ links, onChange, errors }: LinksEditorProps) {
  function update(id: string, patch: Partial<EditableLink>) {
    onChange(links.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }
  function move(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= links.length) return;
    const next = [...links];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(to, 0, item);
    onChange(next);
  }
  function remove(id: string) {
    onChange(links.filter((l) => l.id !== id));
  }
  function add() {
    if (links.length >= 20) {
      toast.error("Máximo 20 links");
      return;
    }
    onChange([...links, { id: newLinkId(), label: "", url: "", icon: "otro", visible: true }]);
  }

  return (
    <div className="flex flex-col gap-3">
      {links.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Aún no tienes links. Agrega tu Instagram, TikTok, YouTube o lo que quieras que vean
          tus pacientes.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {links.map((l, i) => (
          <li
            key={l.id}
            className={cn(
              "flex gap-3 rounded-xl border border-border bg-background p-3",
              !l.visible && "opacity-70",
            )}
          >
            <div className="flex flex-col items-center justify-center gap-0.5">
              <button
                type="button"
                aria-label="Subir"
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Bajar"
                className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                disabled={i === links.length - 1}
                onClick={() => move(i, 1)}
              >
                <ChevronDown className="size-4" />
              </button>
            </div>

            <div className="grid min-w-0 flex-1 gap-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                <Input
                  aria-label="Título del link"
                  placeholder="Título (p. ej. Instagram)"
                  value={l.label}
                  maxLength={40}
                  onChange={(e) => update(l.id, { label: e.target.value })}
                />
                <Select
                  value={l.icon}
                  onValueChange={(v) => update(l.id, { icon: v as LinkIconKind })}
                >
                  <SelectTrigger aria-label="Ícono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINK_ICONS.map((k) => (
                      <SelectItem key={k} value={k}>
                        <LinkIcon kind={k} className="size-4" />
                        {LINK_ICON_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                aria-label="URL"
                type="url"
                inputMode="url"
                placeholder="https://instagram.com/tu.usuario"
                value={l.url}
                onChange={(e) => {
                  const url = e.target.value;
                  const guessed = l.icon === "otro" ? guessIcon(url) : null;
                  update(l.id, { url, ...(guessed ? { icon: guessed } : {}) });
                }}
              />
            </div>

            <div className="flex flex-col items-center justify-between gap-1">
              <button
                type="button"
                aria-label={l.visible ? "Ocultar link" : "Mostrar link"}
                aria-pressed={l.visible}
                title={l.visible ? "Visible" : "Oculto"}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => update(l.id, { visible: !l.visible })}
              >
                {l.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
              <button
                type="button"
                aria-label="Borrar link"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                onClick={() => remove(l.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {errors?.length ? <p className="text-xs text-destructive">{errors[0]}</p> : null}

      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={add}>
        <Plus /> Agregar link
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Apariencia                                                          */
/* ------------------------------------------------------------------ */

type AppearanceEditorProps = {
  theme: ResolvedTheme;
  hasPhone: boolean;
  onChange: (theme: ResolvedTheme) => void;
};

export function AppearanceEditor({ theme, hasPhone, onChange }: AppearanceEditorProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-2.5">
        <Label>Tema</Label>
        <div role="radiogroup" aria-label="Tema" className="grid grid-cols-5 gap-2">
          {THEME_PRESETS.map((p) => {
            const t = PRESETS[p];
            const active = theme.preset === p;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={t.label}
                onClick={() => onChange({ ...theme, preset: p })}
                className={cn(
                  "group flex flex-col items-center gap-1.5 rounded-xl border p-2 transition-colors",
                  active ? "border-primary ring-2 ring-primary/25" : "border-border hover:bg-secondary",
                )}
              >
                <span
                  className="relative flex size-10 items-center justify-center overflow-hidden rounded-full border border-black/5"
                  style={{ background: t.bg }}
                >
                  <span
                    className="absolute inset-y-0 left-0 w-1/2"
                    style={{ background: t.primary }}
                  />
                  <span
                    className="absolute right-1 bottom-1 size-3 rounded-full"
                    style={{ background: t.accent }}
                  />
                  {active ? (
                    <Check
                      className="relative size-4 drop-shadow"
                      style={{ color: t.primaryFg }}
                      aria-hidden
                    />
                  ) : null}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground group-aria-checked:text-foreground">
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2.5">
        <Label>Estilo de botones</Label>
        <div role="radiogroup" aria-label="Estilo de botones" className="grid grid-cols-3 gap-2">
          {BUTTON_STYLES.map((b) => {
            const active = theme.buttonStyle === b;
            return (
              <button
                key={b}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...theme, buttonStyle: b })}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors",
                  active
                    ? "border-primary ring-2 ring-primary/25"
                    : "border-border text-muted-foreground hover:bg-secondary",
                )}
              >
                <span
                  className="block h-6 w-full bg-primary"
                  style={{ borderRadius: BUTTON_RADIUS[b] }}
                  aria-hidden
                />
                {BUTTON_STYLE_LABELS[b]}
              </button>
            );
          })}
        </div>
      </div>

      <ToggleRow
        id="show-whatsapp"
        title="Botón de WhatsApp"
        description={
          hasPhone
            ? "Muestra “Escríbeme por WhatsApp” debajo de Agendar."
            : "Agrega tu número de WhatsApp en Perfil para activarlo."
        }
        checked={theme.showWhatsApp && hasPhone}
        disabled={!hasPhone}
        onCheckedChange={(v) => onChange({ ...theme, showWhatsApp: v })}
      />
      <ToggleRow
        id="show-reviews"
        title="Mostrar reseñas verificadas"
        description="Solo de pacientes con cita completada. Nunca son obligatorias ni editables."
        checked={theme.showReviews}
        onCheckedChange={(v) => onChange({ ...theme, showReviews: v })}
      />
    </div>
  );
}

function ToggleRow({
  id,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
