import type { Metadata } from "next";
import { CalendarDays, Plus } from "lucide-react";

import { Button, Card, Tabs, TabsList, TabsTrigger } from "@granola/ui";

import { ComingSoonCard } from "@/components/panel/coming-soon";
import { PageHeader } from "@/components/panel/page-header";

export const metadata: Metadata = { title: "Agenda" };

export default function AgendaPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Agenda" description="Tus citas, disponibilidad y servicios.">
        <Button size="sm" disabled>
          <Plus /> Nueva cita
        </Button>
      </PageHeader>

      <Tabs defaultValue="dia">
        <TabsList>
          <TabsTrigger value="dia">Día</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="disponibilidad">Disponibilidad</TabsTrigger>
        </TabsList>
      </Tabs>

      <ComingSoonCard
        icon={CalendarDays}
        title="Aquí verás tus citas"
        description="Reservas desde tu página pública, sincronizadas con Google Calendar y con recordatorios por WhatsApp."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-2 border-dashed shadow-none">
          <p className="text-sm font-semibold">Servicios</p>
          <p className="text-sm text-muted-foreground">
            Primera consulta, seguimiento, paquetes. Duración, precio y modalidad.
          </p>
        </Card>
        <Card className="gap-2 border-dashed shadow-none">
          <p className="text-sm font-semibold">Disponibilidad semanal</p>
          <p className="text-sm text-muted-foreground">
            Horarios por día, excepciones, buffer entre citas y zona horaria.
          </p>
        </Card>
      </div>
    </div>
  );
}
