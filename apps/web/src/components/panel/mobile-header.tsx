"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback } from "@granola/ui";

import { navItems, isNavActive, type PanelUser } from "./nav";

export function MobileHeader({ user }: { user: PanelUser }) {
  const pathname = usePathname();
  const title = pathname.startsWith("/app/pacientes/")
    ? "Expediente"
    : navItems.find((item) => isNavActive(pathname, item.href))?.label ?? "Granola";
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:hidden">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <Link href="/app/configuracion" aria-label="Configuración" className="flex size-12 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-primary">
        <Avatar className="size-8">
          <AvatarFallback className="text-xs">{user.initials}</AvatarFallback>
        </Avatar>
      </Link>
    </header>
  );
}
