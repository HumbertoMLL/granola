import Link from "next/link";

import { Button } from "@granola/ui";

import { Logo } from "@/components/logo";

const links = [
  { href: "#diferenciadores", label: "Por qué Granola" },
  { href: "#precios", label: "Precios" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-4 md:px-8">
        <Link href="/" aria-label="Granola, inicio" className="rounded-md">
          <Logo size={24} />
        </Link>

        <nav
          aria-label="Principal"
          className="hidden items-center gap-8 md:flex"
        >
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
          <Button asChild variant="ghost" size="sm" className="inline-flex">
            {/* TODO(auth): ruta real de login */}
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            {/* TODO(auth): ruta real de registro */}
            <Link href="/registro">Empieza gratis</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
