import Link from "next/link";
import { ArrowUpRight, CalendarDays, Copy, Wallet } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@granola/ui";

import { Suspense } from "react";

import { initialsOf } from "@/components/panel/nav";
import { requireNutritionist } from "@/lib/session";
import { PageHeader } from "@/components/panel/page-header";

export default function DashboardPage() {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-56" />}>
      <DashboardPageContent />
    </Suspense>
  );
}

async function DashboardPageContent() {
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
      <PageHeader
        title={`Hola, ${me.name.split(" ")[0]}`}
        description="Esto es lo que tienes hoy."
      >
        <Button asChild variant="outline" size="sm">
          {/* TODO: link real a la página pública del nutri */}
          <Link href={`/${me.slug}`} target="_blank">
            Ver mi página <ArrowUpRight />
          </Link>
        </Button>
      </PageHeader>

      {/* Bloque de link público: lo primero que debe hacer una nutri nueva */}
      <Card className="flex-row items-center justify-between gap-4 bg-primary-soft/60 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wider text-primary uppercase">
            Tu link para la bio
          </p>
          <p className="truncate font-semibold">granola.app/@{me.slug}</p>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" disabled>
          <Copy /> Copiar
        </Button>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Citas de hoy</CardDescription>
            <CardTitle className="text-3xl font-extrabold">0</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Aún no tienes citas agendadas para hoy.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Próximas citas</CardDescription>
            <CardTitle className="text-3xl font-extrabold">0</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cuando alguien agende desde tu página, aparecerá aquí.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Ingresos del mes</CardDescription>
            <CardTitle className="text-3xl font-extrabold">$0</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Cobros con tarjeta, SPEI y OXXO. Comisión Granola: $0.
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" /> Hoy
            </CardTitle>
            <CardDescription>Tu agenda del día, en orden.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium">Sin citas hoy</p>
              <p className="text-sm text-muted-foreground">
                Configura tu disponibilidad para empezar a recibir reservas.
              </p>
              <Badge variant="accent" className="mt-2">
                Próximamente
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" /> Últimos cobros
            </CardTitle>
            <CardDescription>Pagos confirmados de tus pacientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
              <p className="text-sm font-medium">Todavía no hay cobros</p>
              <p className="text-sm text-muted-foreground">
                Conecta Stripe para cobrar con 0% de comisión.
              </p>
              <Badge variant="accent" className="mt-2">
                Próximamente
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
