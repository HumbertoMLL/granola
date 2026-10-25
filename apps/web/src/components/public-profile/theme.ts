import type { CSSProperties } from "react";
import type {
  ButtonStyle,
  LinkIcon,
  NutritionistTheme,
  ThemePreset,
} from "@granola/db/schema";

export type { ButtonStyle, LinkIcon, ThemePreset };

// Listas en runtime (los tipos viven en el schema; importarlos ahí es solo `import type`
// para que este archivo sea seguro en el cliente).
export const THEME_PRESETS = [
  "avena",
  "menta",
  "lavanda",
  "durazno",
  "carbon",
] as const satisfies readonly ThemePreset[];
export const BUTTON_STYLES = [
  "pill",
  "rounded",
  "square",
] as const satisfies readonly ButtonStyle[];
export const LINK_ICONS = [
  "instagram",
  "tiktok",
  "youtube",
  "whatsapp",
  "web",
  "otro",
] as const satisfies readonly LinkIcon[];

export const LINK_ICON_LABELS: Record<LinkIcon, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  web: "Sitio web",
  otro: "Otro",
};

export function isLinkIcon(v: unknown): v is LinkIcon {
  return typeof v === "string" && (LINK_ICONS as readonly string[]).includes(v);
}

/**
 * Tokens de un preset. Se aplican como CSS variables (--pp-*) en el wrapper de la
 * página pública, por encima del design system de Granola. El contenido usa
 * clases Tailwind con `(--pp-x)` para que el mismo markup sirva en los 5 temas.
 */
export type PresetTokens = {
  label: string;
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  primary: string;
  primaryFg: string;
  accent: string;
  border: string;
  /** Fondo decorativo (gradiente) detrás del header. */
  glow: string;
  dark?: boolean;
};

export const PRESETS: Record<ThemePreset, PresetTokens> = {
  avena: {
    label: "Avena",
    bg: "#FBF7F0",
    surface: "#FFFFFF",
    fg: "#2B2118",
    muted: "#74685E",
    primary: "#4A7A2B",
    primaryFg: "#FFFFFF",
    accent: "#E8A93B",
    border: "#E8E0D2",
    glow: "radial-gradient(60% 50% at 50% 0%, #FBEFD6 0%, rgba(251,239,214,0) 100%)",
  },
  menta: {
    label: "Menta",
    bg: "#EEF7F2",
    surface: "#FFFFFF",
    fg: "#12322A",
    muted: "#4D6F61",
    primary: "#147456",
    primaryFg: "#FFFFFF",
    accent: "#FFD166",
    border: "#D4E8DE",
    glow: "radial-gradient(60% 50% at 50% 0%, #D3F0E2 0%, rgba(211,240,226,0) 100%)",
  },
  lavanda: {
    label: "Lavanda",
    bg: "#F4F1FA",
    surface: "#FFFFFF",
    fg: "#2A2340",
    muted: "#6D6287",
    primary: "#6B4FD8",
    primaryFg: "#FFFFFF",
    accent: "#F2A7C3",
    border: "#E3DDF2",
    glow: "radial-gradient(60% 50% at 50% 0%, #E6DEFA 0%, rgba(230,222,250,0) 100%)",
  },
  durazno: {
    label: "Durazno",
    bg: "#FFF3EC",
    surface: "#FFFFFF",
    fg: "#3A2419",
    muted: "#7F5E51",
    primary: "#B4482D",
    primaryFg: "#FFFFFF",
    accent: "#F9C97C",
    border: "#F3DCCF",
    glow: "radial-gradient(60% 50% at 50% 0%, #FFE1D1 0%, rgba(255,225,209,0) 100%)",
  },
  carbon: {
    label: "Carbón",
    bg: "#15171C",
    surface: "#1F2229",
    fg: "#F4F4F2",
    muted: "#A2A6B0",
    primary: "#9BE35B",
    primaryFg: "#15171C",
    accent: "#F2C14E",
    border: "#2C3038",
    glow: "radial-gradient(60% 50% at 50% 0%, #2A3A22 0%, rgba(42,58,34,0) 100%)",
    dark: true,
  },
};

export const BUTTON_RADIUS: Record<ButtonStyle, string> = {
  pill: "999px",
  rounded: "6px",
  square: "6px",
};

export const BUTTON_STYLE_LABELS: Record<ButtonStyle, string> = {
  pill: "Píldora",
  rounded: "Redondeado",
  square: "Recto",
};

export type ResolvedTheme = {
  preset: ThemePreset;
  buttonStyle: ButtonStyle;
  showWhatsApp: boolean;
  showReviews: boolean;
};

export const DEFAULT_THEME: ResolvedTheme = {
  preset: "avena",
  buttonStyle: "pill",
  showWhatsApp: false,
  showReviews: true,
};

export function isPreset(v: unknown): v is ThemePreset {
  return (
    typeof v === "string" && (THEME_PRESETS as readonly string[]).includes(v)
  );
}
export function isButtonStyle(v: unknown): v is ButtonStyle {
  return (
    typeof v === "string" && (BUTTON_STYLES as readonly string[]).includes(v)
  );
}

/** Normaliza el jsonb `theme` (puede venir vacío o con campos legacy). */
export function resolveTheme(
  theme: NutritionistTheme | null | undefined,
): ResolvedTheme {
  return {
    preset: isPreset(theme?.preset) ? theme.preset : DEFAULT_THEME.preset,
    buttonStyle: isButtonStyle(theme?.buttonStyle)
      ? theme.buttonStyle
      : DEFAULT_THEME.buttonStyle,
    showWhatsApp: theme?.showWhatsApp ?? DEFAULT_THEME.showWhatsApp,
    showReviews: theme?.showReviews ?? DEFAULT_THEME.showReviews,
  };
}

/** CSS variables inline para el wrapper de la página pública. */
export function themeStyle(theme: ResolvedTheme): CSSProperties {
  const t = PRESETS[theme.preset];
  return {
    "--pp-bg": t.bg,
    "--pp-surface": t.surface,
    "--pp-secondary": `color-mix(in srgb, ${t.fg} 4%, ${t.bg})`,
    "--pp-fg": t.fg,
    "--pp-muted": t.muted,
    "--pp-primary": t.primary,
    "--pp-primary-hover": `color-mix(in srgb, ${t.primary} 90%, ${t.fg})`,
    "--pp-booking-primary": t.primary,
    "--pp-booking-fg": t.primaryFg,
    "--pp-primary-fg": t.primaryFg,
    "--pp-accent": t.accent,
    "--pp-border": `color-mix(in srgb, ${t.fg} 8%, transparent)`,
    "--pp-glow": "none",
    "--pp-radius": "6px",
    colorScheme: t.dark ? "dark" : "light",
  } as CSSProperties;
}
