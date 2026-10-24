import {
  CalendarDays,
  CreditCard,
  Home,
  Link2,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Aparece en la barra inferior de móvil (máximo 5). */
  mobile: boolean;
};

export const navItems: NavItem[] = [
  { href: "/app", label: "Inicio", icon: Home, mobile: true },
  { href: "/app/agenda", label: "Agenda", icon: CalendarDays, mobile: true },
  { href: "/app/pacientes", label: "Pacientes", icon: Users, mobile: true },
  { href: "/app/cobros", label: "Cobros", icon: CreditCard, mobile: true },
  { href: "/app/mi-pagina", label: "Mi página", icon: Link2, mobile: true },
  { href: "/app/configuracion", label: "Configuración", icon: Settings, mobile: false },
];

/** Activo si es la ruta exacta o una subruta (salvo /app, que solo es exacto). */
export function isNavActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Lo que el shell del panel necesita mostrar del usuario en sesión. */
export type PanelUser = {
  name: string;
  slug: string;
  initials: string;
  plan: string;
};

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "N";
}
