// Layout de la página pública de la nutri y sus subrutas (/[slug]/agendar la hace
// otro workstream). Sin header/footer de marketing: esto es lo que la paciente
// abre desde Instagram, debe sentirse como la página de la nutri, no de Granola.
export default function PublicProfileLayout({ children }: LayoutProps<"/[slug]">) {
  return <div className="flex min-h-full flex-1 flex-col">{children}</div>;
}
