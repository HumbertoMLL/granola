import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Link2 } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  Input,
  Label,
  Switch,
  Textarea,
  Skeleton,
} from "@granola/ui";

import { ComingSoonCard } from "@/components/panel/coming-soon";
import { Suspense } from "react";

import { initialsOf } from "@/components/panel/nav";
import { requireNutritionist } from "@/lib/session";
import { PageHeader } from "@/components/panel/page-header";

export const metadata: Metadata = { title: "Mi página" };

export default function MiPaginaPage() {
  return (
    <Suspense fallback={<Skeleton className="h-10 w-56" />}>
      <MiPaginaPageContent />
    </Suspense>
  );
}

async function MiPaginaPageContent() {
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
        title="Mi página"
        description="Lo que ven tus pacientes cuando entran a tu link."
      >
        <Button asChild variant="outline" size="sm">
          {/* TODO: link real a la página pública */}
          <Link href={`/${me.slug}`} target="_blank">
            Ver página <ArrowUpRight />
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* Formulario deshabilitado: solo muestra el shape del editor */}
        <Card className="gap-5">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="text-lg">{me.initials}</AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm" disabled>
              Cambiar foto
            </Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="display-name">Nombre que se muestra</Label>
            <Input id="display-name" defaultValue={me.name} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="slug">Tu link</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">granola.app/@</span>
              <Input id="slug" defaultValue={me.slug} disabled />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="Qué haces, para quién y cómo trabajas. Dos o tres líneas."
              disabled
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Mostrar reseñas verificadas</p>
              <p className="text-xs text-muted-foreground">
                Solo de pacientes con cita completada.
              </p>
            </div>
            <Switch disabled defaultChecked />
          </div>
          <Button className="w-fit" disabled>
            Guardar cambios
          </Button>
        </Card>

        <ComingSoonCard
          icon={Link2}
          title="Vista previa en vivo"
          description="Aquí verás tu página pública tal como la ve un paciente desde el celular: foto, bio, links, servicios y botón de agendar."
        />
      </div>
    </div>
  );
}
