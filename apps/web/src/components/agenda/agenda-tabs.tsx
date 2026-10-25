"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@granola/ui";

import { type AppointmentRow } from "./appointments-list";
import {
  AvailabilityEditor,
  type OverrideRow,
  type RuleRow,
  type SchedulingSettingsRow,
} from "./availability-editor";
import { ServicesManager, type ServiceRow } from "./services-manager";

import { AgendaCalendar } from "./agenda-calendar";

export type AgendaData = {
  slug: string;
  timezone: string;
  scheduling: SchedulingSettingsRow;
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
  const initial: Tab = TABS.includes(fromUrl as Tab)
    ? (fromUrl as Tab)
    : "citas";
  const tab = initial;

  function onChange(v: string) {
    const t = v as Tab;
    const sp = new URLSearchParams(params.toString());
    if (t === "citas") sp.delete("tab");
    else sp.set("tab", t);
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={tab} onValueChange={onChange} className="gap-4">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="citas">Citas</TabsTrigger>
        <TabsTrigger value="servicios">Servicios</TabsTrigger>
        <TabsTrigger value="disponibilidad">Disponibilidad</TabsTrigger>
      </TabsList>

      <TabsContent value="citas">
        <AgendaCalendar data={data} />
      </TabsContent>
      <TabsContent value="servicios">
        <ServicesManager services={data.services} />
      </TabsContent>
      <TabsContent value="disponibilidad">
        <AvailabilityEditor
          rules={data.rules}
          overrides={data.overrides}
          timezone={data.timezone}
          scheduling={data.scheduling}
        />
      </TabsContent>
    </Tabs>
  );
}
