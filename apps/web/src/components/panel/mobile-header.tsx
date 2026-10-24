import Link from "next/link";

import { Avatar, AvatarFallback } from "@granola/ui";

import { Logo } from "@/components/logo";
import type { PanelUser } from "./nav";

export function MobileHeader({ user }: { user: PanelUser }) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md md:hidden">
      <Link href="/app" aria-label="Granola, inicio" className="rounded-full">
        <Logo size={28} />
      </Link>
      <Link href="/app/configuracion" aria-label="Configuración" className="rounded-full">
        <Avatar className="size-9">
          <AvatarFallback className="text-xs">{user.initials}</AvatarFallback>
        </Avatar>
      </Link>
    </header>
  );
}
