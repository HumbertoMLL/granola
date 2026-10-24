import Link from "next/link";

import { Button } from "@granola/ui";

import { Logo } from "@/components/logo";

const links = [
  { href: "#diferenciadores", label: "Por qué Granola" },
  { href: "#precios", label: "Precios" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Granola, inicio" className="rounded-full">
          <Logo size={30} />
        </Link>

        <nav aria-label="Principal" className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            {/* TODO(auth): ruta real de login */}
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild size="sm">
            {/* TODO(auth): ruta real de registro */}
            <Link href="/registro">Empieza gratis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
