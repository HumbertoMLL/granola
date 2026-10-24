import type { Metadata } from "next";
import { CreditCard, Store, Wallet } from "lucide-react";

import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from "@granola/ui";

import { ComingSoonCard } from "@/components/panel/coming-soon";
import { PageHeader } from "@/components/panel/page-header";

export const metadata: Metadata = { title: "Cobros" };

export default function CobrosPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cobros" description="Lo que te pagan tus pacientes, sin comisión.">
        <Badge>Comisión Granola: 0%</Badge>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Este mes</CardDescription>
            <CardTitle className="text-3xl font-extrabold">$0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pendientes (SPEI / OXXO)</CardDescription>
            <CardTitle className="text-3xl font-extrabold">0</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Pagos en consulta</CardDescription>
            <CardTitle className="text-3xl font-extrabold">0</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <CreditCard className="size-5" />
          </div>
          <div>
            <p className="font-semibold">Tarjeta con Stripe</p>
            <p className="text-sm text-muted-foreground">
              Conecta tu cuenta y el dinero llega directo a ti.
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-fit" disabled>
            Conectar Stripe
          </Button>
        </Card>
        <Card className="gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-accent-soft text-[#8a5a0b]">
            <Store className="size-5" />
          </div>
          <div>
            <p className="font-semibold">SPEI y OXXO con Mercado Pago</p>
            <p className="text-sm text-muted-foreground">
              Para pacientes sin tarjeta. La cita se confirma al acreditarse el pago.
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-fit" disabled>
            Conectar Mercado Pago
          </Button>
        </Card>
      </div>

      <ComingSoonCard
        icon={Wallet}
        title="Historial de cobros"
        description="Cada pago con su cita, paciente, método y estado. Exportable."
      />
    </div>
  );
}
