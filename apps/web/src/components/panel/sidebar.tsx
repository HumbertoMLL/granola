"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { Avatar, AvatarFallback, Badge, cn } from "@granola/ui";

import { Logo } from "@/components/logo";
import { isNavActive, navItems, type PanelUser } from "./nav";

export function Sidebar({ user }: { user: PanelUser }) {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/app" aria-label="Granola, inicio" className="rounded-full">
          <Logo size={30} />
        </Link>
      </div>

      <nav aria-label="Panel" className="flex flex-1 flex-col gap-1 px-3 pt-2">
        {navItems.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                active
                  ? "bg-primary-soft text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <item.icon className="size-5 shrink-0" strokeWidth={active ? 2.25 : 2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/app/configuracion"
        className="m-3 flex items-center gap-3 rounded-2xl border border-border p-3 transition-colors hover:bg-secondary"
      >
        <Avatar>
          <AvatarFallback>{user.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs text-muted-foreground">@{user.slug}</p>
            <Badge variant="accent" className="px-1.5 py-0 text-[10px]">
              {user.plan}
            </Badge>
          </div>
        </div>
        <ChevronRight className="size-4 text-muted-foreground" />
      </Link>
    </aside>
  );
}
