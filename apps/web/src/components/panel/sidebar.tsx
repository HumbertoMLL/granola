"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Avatar, AvatarFallback, cn } from "@granola/ui";

import { Logo } from "@/components/logo";
import { isNavActive, navItems, type PanelUser } from "./nav";

export function Sidebar({ user }: { user: PanelUser }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col border-r border-border bg-background md:flex">
      <div className="flex h-20 items-center px-8">
        <Link href="/app" aria-label="Granola, inicio" className="rounded-md">
          <Logo size={30} />
        </Link>
      </div>

      <nav aria-label="Panel" className="flex flex-1 flex-col gap-1 px-4">
        {navItems.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-12 items-center gap-3 rounded-md px-4 text-base font-medium transition-colors",
                active
                  ? "bg-secondary font-semibold text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon
                aria-hidden
                className="size-5 shrink-0"
                strokeWidth={1.75}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <details className="group relative m-4 border-t border-border pt-4">
       <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md p-3 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <Avatar className="size-8">
          <AvatarFallback>{user.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs text-muted-foreground">
              @{user.slug}
            </p>
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground group-open:-rotate-90" aria-hidden />
       </summary>
       <div className="absolute inset-x-0 bottom-full mb-2 rounded-xl border border-border bg-card p-2 shadow-float">
         <Link href="/app/configuracion" className="block rounded-md px-3 py-3 text-sm hover:bg-secondary">Configuración</Link>
         <Link href={`/${user.slug}`} className="block rounded-md px-3 py-3 text-sm hover:bg-secondary">Ver mi página</Link>
       </div>
      </details>
    </aside>
  );
}
