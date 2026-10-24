import type { Metadata } from "next";
import { Bell, CalendarSync, LogOut, MessageCircle, Settings, UserRound } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
} from "@granola/ui";

import { ComingSoonCard } from "@/components/panel/coming-soon";
import { Suspense } from "react";

import { initialsOf } from "@/components/panel/nav";
import { requireNutritionist } from "@/lib/session";
import { PageHeader } from "@/components/panel/page-header";

export const metadata: Metadata = { title: "Configuración" };

const sections = [
  {
    icon: UserRound,
    title: "Cuenta",
    description: "Nombre, correo, cédula profesional y contraseña.",
  },
  {
    icon: CalendarSync,
    title: "Google Calendar",
    description: "Sincroniza disponibilidad y crea eventos con link de Meet.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp",
    description: "Número desde el que escribimos a tus pacientes y plantillas activas.",
  },
  {
    icon: Bell,
    title: "Notificaciones",
    description: "Qué avisos quieres recibir y por dónde.",
  },
];

export default function ConfiguracionPage() {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-56" />}>
      <ConfiguracionPageContent />
    </Suspense>
  );
}

async function ConfiguracionPageContent() {
  const { user, nutritionist } = await requireNutritionist();
  const me = {
    name: nutritionist.displayName,
    slug: nutritionist.slug,
    email: user.email,
    initials: initialsOf(nutritionist.displayName),
    plan: nutritionist.plan,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Configuración" description="Tu cuenta, integraciones y plan." />

      {/* TODO(auth): datos reales de la sesión + botón de cerrar sesión funcional */}
      <Card className="flex-row items-center gap-4">
        <Avatar className="size-14">
          <AvatarFallback className="text-base">{me.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{me.name}</p>
          <p className="truncate text-sm text-muted-foreground">{me.email}</p>
        </div>
        <Badge variant="accent">Plan {me.plan}</Badge>
      </Card>

      <Card className="gap-0 p-0">
        {sections.map((s, i) => (
          <div key={s.title}>
            {i > 0 ? <Separator /> : null}
            <button
              type="button"
              disabled
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary disabled:cursor-default disabled:hover:bg-transparent"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                <s.icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
              <Badge variant="secondary" className="hidden sm:inline-flex">
                Próximamente
              </Badge>
            </button>
          </div>
        ))}
      </Card>

      <ComingSoonCard
        icon={Settings}
        title="Plan y facturación"
        description="Cambiar de plan, método de pago de tu suscripción y facturas de Granola."
      >
        <Card className="mt-2 w-full max-w-sm gap-1 bg-background p-4 text-left shadow-none">
          <CardHeader>
            <CardDescription>Plan actual</CardDescription>
            <CardTitle>Starter · prueba de 14 días</CardTitle>
          </CardHeader>
        </Card>
      </ComingSoonCard>

      <div>
        <Button variant="ghost" className="text-destructive hover:bg-destructive-soft" disabled>
          <LogOut /> Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
