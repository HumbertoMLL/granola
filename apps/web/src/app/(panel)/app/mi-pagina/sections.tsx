"use client";

import * as React from "react";
import {
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
  SegmentedControl,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  cn,
  toast,
} from "@granola/ui";

import { LinkIcon } from "@/components/public-profile/link-icon";
import { initials } from "@/components/public-profile/profile-view";
import {
  BUTTON_STYLES,
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
      (b) =>
        b ? resolve(b) : reject(new Error("No se pudo procesar la imagen")),
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
      toast.error(
        err instanceof Error ? err.message : "No se pudo subir la foto",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-lg">
          {initials(name || "N")}
        </AvatarFallback>
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
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={pending}
            >
              Quitar
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {storageConfigured
            ? "JPG, PNG o WebP. Recorte cuadrado."
            : "La carga de fotos aún no está disponible."}
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
  const [deleting, setDeleting] = React.useState<string | null>(null);
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
    onChange([
      ...links,
      { id: newLinkId(), label: "", url: "", icon: "otro", visible: true },
    ]);
  }

  return (
    <div className="flex flex-col gap-3">
      {links.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Aún no tienes links. Agrega tu Instagram, TikTok, YouTube o lo que
          quieras que vean tus pacientes.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {links.map((l, i) => (
          <li
            key={l.id}
            className={cn(
              "flex gap-3 border-b border-border py-4",
              !l.visible && "opacity-70",
            )}
          >
            <div className="flex flex-col items-center justify-center gap-0.5">
              <button
                type="button"
                aria-label="Subir"
                className="rounded-md p-3 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Bajar"
                className="rounded-md p-3 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
                disabled={i === links.length - 1}
                onClick={() => move(i, 1)}
              >
                <ChevronDown className="size-4" />
              </button>
            </div>

            <div className="grid min-w-0 flex-1 gap-2">
              <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                <div>
                  <Label htmlFor={`link-label-${l.id}`}>Título del link</Label>
                  <Input
                    id={`link-label-${l.id}`}
                    aria-label="Título del link"
                    placeholder="Título (p. ej. Instagram)"
                    value={l.label}
                    maxLength={40}
                    onChange={(e) => update(l.id, { label: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor={`link-icon-${l.id}`}>Ícono</Label>
                  <Select
                    value={l.icon}
                    onValueChange={(v) =>
                      update(l.id, { icon: v as LinkIconKind })
                    }
                  >
                    <SelectTrigger id={`link-icon-${l.id}`} aria-label="Ícono">
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
              </div>
              <Label htmlFor={`link-url-${l.id}`}>URL</Label>
              <Input
                id={`link-url-${l.id}`}
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
                className="rounded-md p-3 text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => update(l.id, { visible: !l.visible })}
              >
                {l.visible ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="size-4" />
                )}
              </button>
              <button
                type="button"
                aria-label="Borrar link"
                className="rounded-md p-3 text-muted-foreground hover:bg-destructive-soft hover:text-destructive-ink"
                onClick={() => setDeleting(l.id)}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Borrar este link?</DialogTitle>
            <DialogDescription>
              Se quitará de tu página al guardar los cambios.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) remove(deleting);
                setDeleting(null);
              }}
            >
              Sí, borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {errors?.length ? (
        <p className="text-sm text-destructive-ink">{errors[0]}</p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        onClick={add}
      >
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

export function AppearanceEditor({
  theme,
  hasPhone,
  onChange,
}: AppearanceEditorProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-2">
        <Label>Tema</Label>
        <SegmentedControl
          label="Tema"
          value={theme.preset}
          onValueChange={(preset) =>
            onChange({ ...theme, preset: preset as ResolvedTheme["preset"] })
          }
          options={THEME_PRESETS.map((preset) => ({
            value: preset,
            label: (
              <span className="flex flex-col items-center gap-1">
                <span
                  aria-hidden
                  className="size-6 rounded-md border border-border"
                  style={{ background: PRESETS[preset].primary }}
                />
                <span className="text-[11px]">{PRESETS[preset].label}</span>
              </span>
            ),
          }))}
        />
      </div>

      <div className="grid gap-2">
        <Label>Estilo de botones</Label>
        <SegmentedControl
          label="Estilo de botones"
          value={theme.buttonStyle}
          onValueChange={(buttonStyle) =>
            onChange({
              ...theme,
              buttonStyle: buttonStyle as ResolvedTheme["buttonStyle"],
            })
          }
          options={BUTTON_STYLES.map((style) => ({
            value: style,
            label: (
              <span className="flex flex-col gap-1">
                <span
                  aria-hidden
                  className="h-5 w-12 bg-foreground"
                  style={{
                    borderRadius:
                      style === "pill" ? 999 : style === "rounded" ? 12 : 6,
                  }}
                />
                {
                  { pill: "Clásico", rounded: "Suave", square: "Compacto" }[
                    style
                  ]
                }
              </span>
            ),
          }))}
        />
      </div>

      <ToggleRow
        id="show-whatsapp"
        title="Botón de WhatsApp"
        description={
          hasPhone
            ? "Permite contactarte desde tu página."
            : "Agrega tu número de WhatsApp en Perfil para activarlo."
        }
        checked={theme.showWhatsApp && hasPhone}
        disabled={!hasPhone}
        onCheckedChange={(v) => onChange({ ...theme, showWhatsApp: v })}
      />
      <ToggleRow
        id="show-reviews"
        title="Mostrar reseñas verificadas"
        description="De pacientes con consulta completada."
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
    <div className="flex items-center justify-between gap-4 border-b border-border py-4">
      <div>
        <Label htmlFor={id} className="text-sm font-medium">
          {title}
        </Label>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
