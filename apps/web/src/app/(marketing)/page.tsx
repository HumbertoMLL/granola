import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  CalendarCheck2,
  Check,
  MessageCircle,
  Store,
} from "lucide-react";

import { Badge, Button, Card, CardContent } from "@granola/ui";

const differentiators = [
  {
    icon: BadgePercent,
    title: "0% de comisión en tus cobros",
    body: "Cobras con tu propia cuenta de Stripe. Lo que paga tu paciente llega a ti. Nosotros cobramos la mensualidad y ya.",
    note: "Otras plataformas se quedan con 10% de cada consulta.",
  },
  {
    icon: Store,
    title: "SPEI y OXXO para tus pacientes",
    body: "No todos tienen tarjeta. Tu paciente paga por transferencia o en la tienda de la esquina y la cita se confirma sola.",
    note: "Tarjeta, SPEI, OXXO o pago en consulta: tú decides por servicio.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp en todos los planes",
    body: "Confirmación al agendar, recordatorio 24 h y 2 h antes, y link para reagendar. Menos no-shows sin que tú escribas nada.",
    note: "Incluido desde el plan Starter, no solo en el caro.",
  },
];

const plans = [
  {
    name: "Starter",
    price: 249,
    tagline: "Para empezar a llenar la agenda.",
    features: [
      "Página pública con tu link para IG y TikTok",
      "Agenda y reservas con Google Calendar",
      "Cobros con tarjeta, SPEI y OXXO (0% comisión)",
      "WhatsApp: confirmación y recordatorios",
      "Reseñas verificadas",
    ],
    cta: "Probar 14 días",
    highlighted: false,
  },
  {
    name: "Pro",
    price: 499,
    tagline: "Para dar consulta completa.",
    features: [
      "Todo lo de Starter",
      "Expediente y antropometría",
      "Planes por equivalentes SMAE",
      "App para tus pacientes",
      "Notas de consulta con IA",
    ],
    cta: "Probar 14 días",
    highlighted: true,
  },
  {
    name: "Clínica",
    price: 999,
    tagline: "Para equipos de varios nutris.",
    features: [
      "Todo lo de Pro",
      "Varias nutriólogas en una cuenta",
      "Facturación CFDI automática",
      "Agenda compartida",
      "Soporte prioritario",
    ],
    cta: "Probar 14 días",
    highlighted: false,
  },
];

const mxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--accent-soft)_0%,transparent_70%)]"
        />
        <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pt-16 pb-14 text-center sm:px-6 md:pt-24 md:pb-20">
          <Badge variant="accent" className="animate-fade-up mb-6">
            Para nutriólogas que atienden online
          </Badge>
          <h1 className="animate-fade-up max-w-4xl font-display text-[2.6rem] leading-[1.02] tracking-tight text-foreground [animation-delay:60ms] sm:text-6xl md:text-7xl">
            La app que tus pacientes <em className="text-primary">sí usan</em>, y la agenda que
            te llena la consulta.
          </h1>
          <p className="animate-fade-up mt-6 max-w-2xl text-lg text-muted-foreground [animation-delay:120ms] md:text-xl">
            Tu página pública, reservas en línea, cobros sin comisión y WhatsApp automático. Todo
            lo que necesitas para que agenden contigo desde Instagram, en una sola app.
          </p>
          <div className="animate-fade-up mt-9 flex w-full flex-col items-center gap-3 [animation-delay:180ms] sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              {/* TODO(auth): ruta real de registro */}
              <Link href="/registro">
                Empieza gratis 14 días <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <a href="#precios">Ver precios</a>
            </Button>
          </div>
          <p className="animate-fade-up mt-4 text-sm text-muted-foreground [animation-delay:240ms]">
            Sin tarjeta. Cancelas en un clic.
          </p>
        </div>

        {/* Mock de la página pública + agenda */}
        <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 md:pb-24">
          <div className="animate-fade-up grid gap-4 [animation-delay:300ms] md:grid-cols-[1.1fr_1fr]">
            <Card className="gap-4 p-6 md:p-8">
              <div className="flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-lg font-bold text-primary">
                  KD
                </div>
                <div>
                  <p className="font-semibold">Karla Demo, Nutrióloga</p>
                  <p className="text-sm text-muted-foreground">granola.app/@karla</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Consulta online para mujeres que quieren comer bien sin dietas de castigo.
              </p>
              <div className="grid gap-2">
                {[
                  { name: "Primera consulta · 60 min", price: 650 },
                  { name: "Seguimiento · 30 min", price: 400 },
                  { name: "Paquete 4 seguimientos", price: 1400 },
                ].map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-sm"
                  >
                    <span>{s.name}</span>
                    <span className="font-semibold">{mxn.format(s.price)}</span>
                  </div>
                ))}
              </div>
              <Button className="mt-1 w-full" size="lg">
                <CalendarCheck2 /> Agendar consulta
              </Button>
            </Card>

            <div className="grid gap-4">
              <Card className="gap-3 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <MessageCircle className="size-4 text-primary" /> WhatsApp automático
                </div>
                <div className="rounded-2xl rounded-tl-md bg-primary-soft px-4 py-3 text-sm text-foreground">
                  Hola Ana 👋 Tu consulta con Karla quedó confirmada para el{" "}
                  <strong>jueves 10:00</strong>. Te mando el link de Meet aquí mismo un rato
                  antes. ¿Necesitas reagendar? Toca aquí.
                </div>
                <p className="text-xs text-muted-foreground">
                  Enviado al confirmar el pago · recordatorio 24 h y 2 h antes
                </p>
              </Card>
              <Card className="gap-3 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Store className="size-4 text-primary" /> Pago recibido
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{mxn.format(650)} MXN</p>
                    <p className="text-sm text-muted-foreground">OXXO · Ana López</p>
                  </div>
                  <Badge>Comisión Granola: $0</Badge>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Diferenciadores */}
      <section id="diferenciadores" className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">
              Por qué Granola
            </p>
            <h2 className="mt-3 font-display text-4xl leading-tight tracking-tight md:text-5xl">
              Tres cosas que las otras apps no te dan.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Granola no te vende recetas infinitas. Te ayuda a que más pacientes agenden, paguen
              y lleguen a la consulta.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {differentiators.map((d) => (
              <Card key={d.title} className="gap-4 bg-background p-6">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <d.icon className="size-5" />
                </div>
                <h3 className="text-xl font-bold tracking-tight">{d.title}</h3>
                <p className="text-muted-foreground">{d.body}</p>
                <p className="mt-auto border-t border-border pt-4 text-sm text-muted-foreground">
                  {d.note}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Precios */}
      <section id="precios">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">Precios</p>
            <h2 className="mt-3 font-display text-4xl leading-tight tracking-tight md:text-5xl">
              Precio plano por nutrióloga. Sin tope de pacientes.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Prueba 14 días sin tarjeta. Cancelas en un clic. Anual con 20% de descuento.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {plans.map((p) => (
              <Card
                key={p.name}
                className={
                  p.highlighted
                    ? "relative gap-6 border-primary p-7 shadow-float ring-1 ring-primary"
                    : "gap-6 p-7"
                }
              >
                {p.highlighted ? (
                  <Badge variant="solid" className="absolute -top-3 left-6">
                    El más elegido
                  </Badge>
                ) : null}
                <div>
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{p.tagline}</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight">
                    {mxn.format(p.price)}
                  </span>
                  <span className="text-sm text-muted-foreground">MXN / mes</span>
                </div>
                <CardContent className="p-0">
                  <ul className="flex flex-col gap-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <Button
                  asChild
                  variant={p.highlighted ? "primary" : "outline"}
                  size="lg"
                  className="mt-auto w-full"
                >
                  {/* TODO(auth): ruta real de registro con plan preseleccionado */}
                  <Link href={`/registro?plan=${p.name.toLowerCase()}`}>{p.cta}</Link>
                </Button>
              </Card>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Precios tentativos de lanzamiento. Los planes Pro y Clínica incluyen funciones que
            vamos liberando por fases.
          </p>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 md:py-20">
          <h2 className="max-w-3xl font-display text-4xl leading-tight tracking-tight md:text-5xl">
            Pon tu link en la bio hoy y deja que agenden mientras das consulta.
          </h2>
          <Button asChild size="lg" variant="accent">
            {/* TODO(auth): ruta real de registro */}
            <Link href="/registro">
              Crear mi página gratis <ArrowRight />
            </Link>
          </Button>
          <p className="text-sm text-primary-foreground/80">14 días gratis · sin tarjeta</p>
        </div>
      </section>
    </>
  );
}
