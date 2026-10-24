import type { Metadata } from "next";
import { Plus, Search, Users } from "lucide-react";

import { Button, Input } from "@granola/ui";

import { ComingSoonCard } from "@/components/panel/coming-soon";
import { PageHeader } from "@/components/panel/page-header";

export const metadata: Metadata = { title: "Pacientes" };

export default function PacientesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pacientes" description="Tu lista de pacientes y su expediente.">
        <Button size="sm" disabled>
          <Plus /> Nuevo paciente
        </Button>
      </PageHeader>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nombre o WhatsApp" className="pl-11" disabled />
      </div>

      <ComingSoonCard
        icon={Users}
        title="Todavía no tienes pacientes"
        description="Cuando alguien agende contigo se crea solo, con su consentimiento de datos registrado. También podrás importarlos desde Excel."
      />
    </div>
  );
}
