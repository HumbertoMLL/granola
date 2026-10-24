"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Clock, Sparkles } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@granola/ui";

import { AppointmentsList, type AppointmentRow } from "./appointments-list";
import { AvailabilityEditor, type OverrideRow, type RuleRow } from "./availability-editor";
import { ServicesManager, type ServiceRow } from "./services-manager";

export type AgendaData = {
  timezone: string;
  nowIso: string;
  appointments: AppointmentRow[];
  services: ServiceRow[];
  rules: RuleRow[];
  overrides: OverrideRow[];
};

const TABS = ["citas", "servicios", "disponibilidad"] as const;
type Tab = (typeof TABS)[number];

export function AgendaTabs({ data }: { data: AgendaData }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fromUrl = params.get("tab");
  const initial: Tab = TABS.includes(fromUrl as Tab) ? (fromUrl as Tab) : "citas";
  const [tab, setTab] = React.useState<Tab>(initial);

  function onChange(v: string) {
    const t = v as Tab;
    setTab(t);
    const sp = new URLSearchParams(params.toString());
    if (t === "citas") sp.delete("tab");
    else sp.set("tab", t);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={onChange} className="gap-5">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="citas">
          <CalendarDays /> Citas
        </TabsTrigger>
        <TabsTrigger value="servicios">
          <Sparkles /> Servicios
        </TabsTrigger>
        <TabsTrigger value="disponibilidad">
          <Clock /> Disponibilidad
        </TabsTrigger>
      </TabsList>

      <TabsContent value="citas">
        <AppointmentsList appointments={data.appointments} timezone={data.timezone} nowIso={data.nowIso} />
      </TabsContent>
      <TabsContent value="servicios">
        <ServicesManager services={data.services} />
      </TabsContent>
      <TabsContent value="disponibilidad">
        <AvailabilityEditor rules={data.rules} overrides={data.overrides} timezone={data.timezone} />
      </TabsContent>
    </Tabs>
  );
}
