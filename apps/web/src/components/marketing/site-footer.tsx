import Link from "next/link";

import { Logo } from "@/components/logo";

const columns = [
  {
    title: "Producto",
    links: [
      { href: "#diferenciadores", label: "Por qué Granola" },
      { href: "#precios", label: "Precios" },
      { href: "/app", label: "Entrar al panel" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacidad", label: "Aviso de privacidad" },
      { href: "/terminos", label: "Términos y condiciones" },
    ],
  },
  {
    title: "Contacto",
    links: [
      { href: "mailto:hola@granola.app", label: "hola@granola.app" },
      { href: "https://instagram.com", label: "Instagram" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo size={28} />
          <p className="max-w-xs text-sm text-muted-foreground">
            La app que tus pacientes sí usan, y la agenda que te llena la consulta. Hecha en
            México para nutriólogas que atienden online.
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title} className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {col.title}
            </h3>
            <ul className="flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/* Año fijo: con cacheComponents, new Date() en prerender rompe el build */}
          <p>© 2026 Granola. Todos los derechos reservados.</p>
          <p>Tus datos y los de tus pacientes se tratan conforme a la LFPDPPP.</p>
        </div>
      </div>
    </footer>
  );
}
