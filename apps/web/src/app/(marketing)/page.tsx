import Link from "next/link";
import {
  ArrowRight,
  BadgePercent,
  Check,
  MessageCircle,
  Store,
} from "lucide-react";
import { Avatar, AvatarFallback, Badge, Button, Card } from "@granola/ui";

const differentiators = [
  {
    icon: BadgePercent,
    title: "0% de comisión",
    body: "Cobras con tu cuenta de Stripe. Granola no se queda con una parte de tus consultas.",
  },
  {
    icon: Store,
    title: "Tarjeta, SPEI y OXXO",
    body: "Tu paciente elige cómo pagar. Tú decides si cobras al reservar o en consulta.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp incluido",
    body: "Confirmación, recordatorios y un enlace para reagendar. En todos los planes.",
  },
];
const plans = [
  {
    name: "Starter",
    price: 249,
    tagline: "Tu agenda y tu página, conectadas.",
    features: [
      "Página pública con tu link",
      "Agenda y Google Calendar",
      "Tarjeta, SPEI y OXXO",
      "WhatsApp y recordatorios",
      "Reseñas verificadas",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    price: 499,
    tagline: "El expediente completo de tu consulta.",
    features: [
      "Todo lo de Starter",
      "Expediente y antropometría",
      "Planes por equivalentes SMAE",
      "App para tus pacientes",
      "Notas de consulta con IA",
    ],
    highlighted: true,
  },
  {
    name: "Clínica",
    price: 999,
    tagline: "Un espacio para todo tu equipo.",
    features: [
      "Todo lo de Pro",
      "Varias nutriólogas en una cuenta",
      "Facturación CFDI automática",
      "Agenda compartida",
      "Soporte prioritario",
    ],
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
      <section className="mx-auto grid max-w-[1120px] items-center gap-12 px-4 py-12 md:grid-cols-[1.1fr_1fr] md:px-8 md:py-16">
        <div className="space-y-6">
          <p className="font-mono text-xs text-muted-foreground">
            Para nutriólogas independientes
          </p>
          <h1 className="max-w-[480px] font-display text-4xl leading-[1.2] tracking-tight">
            Más tiempo para dar consulta.
          </h1>
          <p className="max-w-[480px] text-base text-muted-foreground">
            Tu página, agenda, cobros y WhatsApp en un solo lugar. Comparte tu
            link y deja que tus pacientes reserven.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/registro">
                Empieza gratis 14 días
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#precios">Ver precios</a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Sin tarjeta. Cancelas en un clic.
          </p>
        </div>
        <Card className="gap-6 p-6 md:p-8">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback>KD</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold">Karla Demo</p>
              <p className="text-sm text-muted-foreground">
                Nutrióloga · Consulta online
              </p>
            </div>
          </div>
          <ul className="divide-y divide-border">
            {[
              { name: "Primera consulta", duration: "60 min", price: 800 },
              { name: "Seguimiento", duration: "30 min", price: 500 },
            ].map((service) => (
              <li
                key={service.name}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="text-base font-medium">{service.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {service.duration}
                  </p>
                </div>
                <span className="text-base font-semibold tabular-nums">
                  {mxn.format(service.price)}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Estado de tu reserva
            </p>
            <Badge variant="confirmed">Confirmada</Badge>
          </div>
          <Button asChild variant="outline">
            <Link href="/karla">Ver perfil de ejemplo</Link>
          </Button>
        </Card>
      </section>
      <section id="diferenciadores" className="border-y border-border bg-card">
        <div className="mx-auto max-w-[1120px] space-y-8 px-4 py-12 md:px-8 md:py-16">
          <div className="max-w-[560px] space-y-3">
            <p className="font-mono text-xs text-muted-foreground">
              Por qué Granola
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">
              De la reserva a la consulta.
            </h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {differentiators.map((feature) => (
              <div
                key={feature.title}
                className="space-y-3 border-t border-border pt-6"
              >
                <feature.icon
                  className="size-5 text-muted-foreground"
                  aria-hidden
                />
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="text-base text-muted-foreground">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section
        id="precios"
        className="mx-auto max-w-[1120px] space-y-8 px-4 py-12 md:px-8 md:py-16"
      >
        <div className="max-w-[560px] space-y-3">
          <p className="font-mono text-xs text-muted-foreground">
            Precios · MXN al mes
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Un precio por nutrióloga.
          </h2>
          <p className="text-base text-muted-foreground">
            Sin tope de pacientes. Prueba 14 días sin tarjeta. Ahorra 20% con el
            plan anual.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={
                plan.highlighted
                  ? "gap-6 border-foreground/20 p-6"
                  : "gap-6 p-6"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                {plan.highlighted ? (
                  <Badge variant="done">Más elegido</Badge>
                ) : null}
              </div>
              <div>
                <p className="text-3xl font-semibold tracking-tight tabular-nums">
                  {mxn.format(plan.price)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / mes
                  </span>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.tagline}
                </p>
              </div>
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check
                      className="mt-1 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-auto w-full">
                <Link href={`/registro?plan=${plan.name.toLowerCase()}`}>
                  Probar 14 días
                </Link>
              </Button>
            </Card>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Precios de lanzamiento. Las funciones de Pro y Clínica se liberan por
          fases.
        </p>
      </section>
      <section className="border-t border-border bg-secondary">
        <div className="mx-auto flex max-w-[1120px] flex-col items-start justify-between gap-6 px-4 py-12 md:flex-row md:items-center md:px-8">
          <div className="max-w-[560px] space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight">
              Tu próximo paciente empieza con un link.
            </h2>
            <p className="text-sm text-muted-foreground">
              Crea tu página y compártela en tu bio.
            </p>
          </div>
          <Button asChild size="lg" variant="outline">
            <Link href="/registro">
              Crear mi página
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
