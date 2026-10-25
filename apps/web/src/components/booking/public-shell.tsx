import * as React from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage, cn } from "@granola/ui";
import { initialsOf } from "@/components/panel/nav";

type Nutri = { slug: string; displayName: string; avatarUrl: string | null };

/** El wizard se amplía en desktop; los enlaces transaccionales conservan un marco corto. */
export function PublicShell({
  nutritionist,
  children,
  compact = false,
}: {
  nutritionist: Nutri;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-full flex-1 flex-col",
        compact && "items-center justify-center px-5 py-8",
      )}
    >
      {!compact ? (
        <header className="border-b border-border bg-background">
          <div className="mx-auto flex h-14 w-full max-w-[1040px] items-center px-5">
            <Link
              href={`/${nutritionist.slug}`}
              className="inline-flex min-h-11 min-w-0 items-center gap-3 rounded-md"
            >
              <Avatar className="size-8">
                {nutritionist.avatarUrl ? (
                  <AvatarImage src={nutritionist.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback>
                  {initialsOf(nutritionist.displayName)}
                </AvatarFallback>
              </Avatar>
              <p className="truncate text-base font-medium">
                {nutritionist.displayName}
              </p>
            </Link>
          </div>
        </header>
      ) : null}
      <main
        className={cn(
          "mx-auto w-full max-w-[400px]",
          compact
            ? "w-full"
            : "flex-1 px-5 py-6 has-[[data-booking-flow]]:max-w-[1040px] lg:py-8",
        )}
      >
        {children}
      </main>
      {!compact ? (
        <footer className="px-5 py-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="py-3 hover:underline">
            Granola
          </Link>
          <span className="mx-3" aria-hidden>
            ·
          </span>
          <Link href="/privacidad" className="py-3 hover:underline">
            Aviso de privacidad
          </Link>
        </footer>
      ) : null}
    </div>
  );
}
