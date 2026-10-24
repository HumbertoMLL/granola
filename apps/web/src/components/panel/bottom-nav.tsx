"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@granola/ui";

import { isNavActive, navItems } from "./nav";

const items = navItems.filter((i) => i.mobile).slice(0, 5);

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Panel"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid h-16 grid-cols-5">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-primary-soft",
                  )}
                >
                  <item.icon className="size-5" strokeWidth={active ? 2.25 : 2} />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
