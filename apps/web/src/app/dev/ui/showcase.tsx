"use client";

import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Search,
  Users,
} from "lucide-react";
import {
  AppliedFilters,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DataList,
  DataRow,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  FilterChip,
  FormField,
  Input,
  KPI,
  Label,
  PageHeader,
  SectionHeader,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Skeleton,
  SkeletonKPI,
  SkeletonRow,
  Stepper,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Timeline,
  Toolbar,
  toast,
} from "@granola/ui";

const colors = [
  ["background", "Fondo"],
  ["foreground", "Tinta"],
  ["card", "Superficie"],
  ["secondary", "Agrupación"],
  ["primary", "Acción"],
  ["muted-foreground", "Texto secundario"],
  ["status-confirmed", "Confirmada"],
  ["status-pending", "Pendiente"],
  ["status-done", "Completada"],
  ["status-cancelled", "Cancelada"],
  ["destructive-ink", "Error legible"],
] as const;

export function UIShowcase() {
  const [view, setView] = useState("day");
  const [filter, setFilter] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [step, setStep] = useState(1);
  return (
    <main className="mx-auto w-full max-w-[1120px] space-y-12 px-4 py-8 md:px-8">
      <PageHeader
        title="Sistema visual"
        description="Granola · desarrollo"
        actions={<Badge variant="done">Solo desarrollo</Badge>}
      />
      <section className="space-y-4">
        <SectionHeader title="Tokens" />
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {colors.map(([token, label]) => (
            <li key={token} className="space-y-2">
              <div
                className="h-12 rounded-md border border-border"
                style={{ background: `var(--${token})` }}
              />
              <p className="text-sm font-medium">{label}</p>
              <code className="block break-all font-mono text-xs text-muted-foreground">
                --{token}
              </code>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-4">
          {[4, 8, 12, 16, 24, 32, 48, 64].map((size) => (
            <div key={size} className="space-y-2">
              <div
                className="bg-secondary"
                style={{ width: size, height: size }}
              />
              <span className="font-mono text-xs">{size}</span>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-md border border-border bg-card p-4 text-sm">
            6 px · controles
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            12 px · superficies
          </div>
          <div className="rounded-xl border border-border bg-popover p-4 text-sm shadow-float">
            Una elevación · hojas y menús
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <SectionHeader title="Tipografía" />
        <div className="space-y-3">
          <p className="font-mono text-xs">11 · etiqueta de sistema</p>
          <p className="text-sm text-muted-foreground">13 · Texto secundario</p>
          <p className="text-base">15 · Consulta de seguimiento</p>
          <p className="text-lg font-semibold">17 · Título de sección</p>
          <p className="text-xl font-semibold">22 · Título móvil</p>
          <p className="text-2xl font-semibold">28 · Título desktop</p>
          <p className="text-3xl font-semibold tabular-nums">36 · $12,800</p>
          <p className="text-4xl font-semibold">44 · Display</p>
          <p className="font-display text-[32px] leading-[1.2]">
            Instrument Serif · nombre público
          </p>
        </div>
      </section>
      <section className="space-y-4">
        <SectionHeader title="Botones y estados" />
        <Toolbar label="Variantes de botón">
          <Button>Guardar</Button>
          <Button variant="outline">Cancelar</Button>
          <Button variant="ghost">Ver detalles</Button>
          <Button variant="destructive">Eliminar</Button>
          <Button variant="accent">Revisar</Button>
          <Button variant="link">Abrir página</Button>
          <Button disabled>Deshabilitado</Button>
          <Button loading>Guardando</Button>
          <Button variant="outline">
            Continuar
            <ArrowRight aria-hidden />
          </Button>
        </Toolbar>
        <Toolbar label="Estados">
          <Badge variant="confirmed">Confirmada</Badge>
          <Badge variant="pending">Pago pendiente</Badge>
          <Badge variant="done">Completada</Badge>
          <Badge variant="cancelled">Cancelada</Badge>
          <Badge variant="outline">Online</Badge>
          <Badge variant="secondary">Paciente</Badge>
          <Badge variant="solid">Pagado</Badge>
        </Toolbar>
      </section>
      <section className="space-y-4">
        <SectionHeader title="Formularios" />
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Nombre" hint="Como aparece en tu perfil.">
            <Input defaultValue="Karla Rodríguez" />
          </FormField>
          <FormField label="Correo" error="Escribe un correo válido.">
            <Input type="email" defaultValue="karla@" />
          </FormField>
          <FormField label="Modalidad">
            <Select defaultValue="online">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="presencial">Presencial</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="showcase-switch">Recordatorios</Label>
            <Switch
              id="showcase-switch"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <FormField label="Notas">
            <Textarea placeholder="Agrega una nota" />
          </FormField>
          <div className="space-y-3">
            <Label htmlFor="showcase-consent">Consentimiento</Label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                id="showcase-consent"
                type="checkbox"
                className="size-4 accent-primary"
              />
              <span className="text-sm">Acepto el aviso de privacidad</span>
            </label>
          </div>
        </div>
      </section>
      <section className="space-y-4">
        <SectionHeader title="Navegación y filtros" />
        <SegmentedControl
          label="Vista"
          value={view}
          onValueChange={setView}
          options={[
            { value: "day", label: "Día" },
            { value: "week", label: "Semana" },
          ]}
        />
        <FilterChip pressed={filter} onPressedChange={setFilter}>
          Online
        </FilterChip>
        <AppliedFilters
          filters={filter ? [{ id: "online", label: "Online" }] : []}
          count={filter ? 4 : 8}
          onRemove={() => setFilter(false)}
          onClear={() => setFilter(false)}
        />
        <Tabs defaultValue="appointments">
          <TabsList>
            <TabsTrigger value="appointments">Citas</TabsTrigger>
            <TabsTrigger value="services">Servicios</TabsTrigger>
            <TabsTrigger value="availability">Disponibilidad</TabsTrigger>
          </TabsList>
          <TabsContent value="appointments">
            <p className="text-sm">Contenido de citas.</p>
          </TabsContent>
          <TabsContent value="services">
            <p className="text-sm">Contenido de servicios.</p>
          </TabsContent>
          <TabsContent value="availability">
            <p className="text-sm">Contenido de disponibilidad.</p>
          </TabsContent>
        </Tabs>
        <Stepper
          steps={["Servicio", "Fecha", "Hora", "Tus datos"]}
          currentStep={step}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep((step + 1) % 4)}
        >
          Cambiar paso
        </Button>
      </section>
      <section className="space-y-4">
        <SectionHeader title="Secciones, listas y datos" />
        <Toolbar label="Buscar pacientes">
          <Search className="size-4" aria-hidden />
          <Input
            aria-label="Buscar pacientes"
            placeholder="Buscar paciente"
            className="max-w-64"
          />
          <Button variant="outline">Filtrar</Button>
        </Toolbar>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
          <KPI
            label="Consultas"
            value="24"
            delta="+4 vs. mes anterior"
            trend="up"
          />
          <KPI label="Ingresos" value="$12,800" delta="Este mes" />
          <KPI
            label="Ausencias"
            value="2"
            delta="−1 vs. mes anterior"
            trend="down"
          />
        </div>
        <Separator />
        <DataList aria-label="Pacientes de ejemplo">
          <DataRow
            leading={
              <Avatar className="size-9">
                <AvatarFallback>AM</AvatarFallback>
              </Avatar>
            }
            title="Ana Martínez"
            description="Última cita · mar 27 oct"
            trailing={<ChevronRight aria-hidden className="size-4" />}
          />
          <DataRow
            leading={
              <Avatar className="size-9">
                <AvatarImage src="/sin-foto.png" alt="" />
                <AvatarFallback>LG</AvatarFallback>
              </Avatar>
            }
            title="Laura García"
            description="Primera consulta"
            trailing={<Badge variant="pending">Por confirmar</Badge>}
          />
        </DataList>
        <Card>
          <CardHeader>
            <CardTitle>Consulta inicial</CardTitle>
            <CardDescription>60 minutos · Online</CardDescription>
            <CardAction>
              <Badge variant="outline">Servicio</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">$800</p>
          </CardContent>
          <CardFooter>
            <Button variant="outline">Editar servicio</Button>
          </CardFooter>
        </Card>
      </section>
      <section className="space-y-4">
        <SectionHeader title="Carga y vacíos" />
        <EmptyState
          title="Sin pacientes"
          description="Agrega a tu primer paciente."
          icon={<Users />}
          action={<Button variant="outline">Agregar paciente</Button>}
        />
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <SkeletonRow />
            <SkeletonRow avatar={false} />
          </div>
          <SkeletonKPI />
        </div>
        <Skeleton className="h-1 w-full" />
      </section>
      <section className="space-y-4">
        <SectionHeader title="Agenda" />
        <Timeline
          label="Agenda de ejemplo"
          startMinute={540}
          endMinute={720}
          nowMinute={570}
          blocks={[
            {
              id: "confirmed",
              startMinute: 600,
              endMinute: 660,
              label: "Ana, confirmada",
              status: "confirmed",
              content: (
                <>
                  <p className="font-semibold">Ana Martínez</p>
                  <p className="text-sm text-muted-foreground">
                    Consulta inicial
                  </p>
                </>
              ),
            },
            {
              id: "pending",
              startMinute: 660,
              endMinute: 720,
              label: "Laura, pendiente",
              status: "pending",
              content: (
                <>
                  <p className="font-semibold">Laura García</p>
                  <p className="text-sm text-muted-foreground">Seguimiento</p>
                </>
              ),
            },
          ]}
          freeRanges={[{ startMinute: 540, endMinute: 600 }]}
          onBlockClick={() => toast("Cita seleccionada")}
          onFreeClick={() => toast("Horario disponible")}
        />
      </section>
      <section className="space-y-4">
        <SectionHeader title="Hojas y confirmaciones" />
        <Toolbar label="Elementos elevados">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Ver detalle</Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="mx-auto max-w-[560px]">
              <SheetHeader>
                <SheetTitle>Consulta inicial</SheetTitle>
                <SheetDescription>Ana Martínez · mañana 9:00</SheetDescription>
              </SheetHeader>
              <p>Detalle contextual en una hoja.</p>
              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">Cerrar</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Confirmar borrado</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>¿Eliminar servicio?</DialogTitle>
                <DialogDescription>
                  Esta acción retira el servicio de tu página.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="destructive">Eliminar</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="ghost"
            onClick={() => toast.success("Cambios guardados")}
          >
            Mostrar aviso
          </Button>
          <CalendarDays className="size-4" aria-hidden />
        </Toolbar>
      </section>
    </main>
  );
}
