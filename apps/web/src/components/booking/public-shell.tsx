import * as React from "react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@granola/ui";

import { initialsOf } from "@/components/panel/nav";

type Nutri = { slug: string; displayName: string; avatarUrl: string | null };

/** Marco de las páginas públicas de agenda (sin login): cabecera con la nutri + contenido angosto. */
export function PublicShell({ nutritionist, children }: { nutritionist: Nutri; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-lg items-center gap-3 px-4">
          <Link href={`/${nutritionist.slug}`} className="flex min-w-0 items-center gap-3">
            <Avatar className="size-10">
              {nutritionist.avatarUrl ? <AvatarImage src={nutritionist.avatarUrl} alt="" /> : null}
              <AvatarFallback>{initialsOf(nutritionist.displayName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">{nutritionist.displayName}</p>
              <p className="text-xs text-muted-foreground">Agenda tu consulta</p>
            </div>
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <footer className="py-6 text-center text-xs text-muted-foreground">
        Agenda con{" "}
        <Link href="/" className="font-semibold text-foreground hover:underline">
          Granola
        </Link>
        {" · "}
        <Link href="/privacidad" className="hover:underline">
          Aviso de privacidad
        </Link>
      </footer>
    </div>
  );
}
