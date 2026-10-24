"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Clock, MapPin, Pencil, Plus, Trash2, Video } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Switch,
  Textarea,
  toast,
} from "@granola/ui";

import {
  createService,
  deleteService,
  reorderServices,
  toggleServiceActive,
  updateService,
} from "@/app/(panel)/app/agenda/actions";
import { serviceSchema, type ServiceInput } from "@/components/agenda/schemas";
import {
  MODALITY_LABEL,
  PAYMENT_MODE_LABEL,
  formatDuration,
  formatPrice,
  type Modality,
  type PaymentMode,
} from "@/components/booking/format";

export type ServiceRow = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  currency: string;
  modality: Modality;
  location: string | null;
  isActive: boolean;
  paymentMode: PaymentMode;
  sortOrder: number;
};

type FormState = {
  name: string;
  description: string;
  durationMin: string;
  priceMxn: string;
  modality: Modality;
  location: string;
  paymentMode: PaymentMode;
  isActive: boolean;
};

const EMPTY: FormState = {
  name: "",
  description: "",
  durationMin: "60",
  priceMxn: "",
  modality: "online",
  location: "",
  paymentMode: "optional",
  isActive: true,
};

function toForm(s: ServiceRow): FormState {
  return {
    name: s.name,
    description: s.description ?? "",
    durationMin: String(s.durationMin),
    priceMxn: s.priceCents ? String(s.priceCents / 100) : "0",
    modality: s.modality,
    location: s.location ?? "",
    paymentMode: s.paymentMode,
    isActive: s.isActive,
  };
}

export function ServicesManager({ services }: { services: ServiceRow[] }) {
  const [editing, setEditing] = React.useState<ServiceRow | "new" | null>(null);
  const [pending, startTransition] = React.useTransition();

  const sorted = [...services].sort((a, b) => a.sortOrder - b.sortOrder);

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= sorted.length) return;
    const ids = sorted.map((s) => s.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(target, 0, moved!);
    startTransition(async () => {
      const res = await reorderServices(ids);
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Lo que tus pacientes pueden agendar desde tu página.
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus /> Nuevo servicio
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card className="items-center gap-3 border-dashed py-10 text-center shadow-none">
          <p className="font-semibold">Aún no tienes servicios</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Crea tu primera consulta: nombre, duración, precio y modalidad. Después define tu horario en
            Disponibilidad.
          </p>
          <Button onClick={() => setEditing("new")}>
            <Plus /> Crear primer servicio
          </Button>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((s, i) => (
            <li key={s.id}>
              <Card className={`gap-3 p-4 ${s.isActive ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" /> {formatDuration(s.durationMin)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {s.modality === "online" ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
                        {MODALITY_LABEL[s.modality]}
                      </span>
                      <span className="font-semibold text-foreground">{formatPrice(s.priceCents, s.currency)}</span>
                    </p>
                  </div>
                  <Badge variant={s.isActive ? "default" : "secondary"}>{s.isActive ? "Activo" : "Oculto"}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                    <Pencil /> Editar
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Subir"
                    disabled={pending || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Bajar"
                    disabled={pending || i === sorted.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <div className="ml-auto flex items-center gap-2 text-sm">
                    <Label htmlFor={`active-${s.id}`} className="text-muted-foreground">
                      Visible
                    </Label>
                    <Switch
                      id={`active-${s.id}`}
                      checked={s.isActive}
                      disabled={pending}
                      onCheckedChange={(v) =>
                        startTransition(async () => {
                          const res = await toggleServiceActive(s.id, v);
                          if (!res.ok) toast.error(res.error);
                        })
                      }
                    />
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ServiceSheet
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        editing={editing}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function ServiceSheet({ editing, onClose }: { editing: ServiceRow | "new" | null; onClose: () => void }) {
  const isNew = editing === "new";
  const [form, setForm] = React.useState<FormState>(editing && editing !== "new" ? toForm(editing) : EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: ServiceInput = {
      name: form.name,
      description: form.description,
      durationMin: form.durationMin,
      priceMxn: form.priceMxn === "" ? 0 : form.priceMxn,
      modality: form.modality,
      location: form.location,
      paymentMode: form.paymentMode,
      isActive: form.isActive,
    };
    const parsed = serviceSchema.safeParse(input);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0] ?? "_")] ??= i.message;
      setErrors(fe);
      return;
    }
    if (parsed.data.modality !== "online" && !parsed.data.location) {
      setErrors({ location: "Indica dónde atiendes" });
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = isNew || !editing ? await createService(input) : await updateService(editing.id, input);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        toast.error(res.error);
        return;
      }
      toast.success(isNew ? "Servicio creado" : "Servicio actualizado");
      onClose();
    });
  }

  function remove() {
    if (!editing || editing === "new") return;
    if (!window.confirm("¿Eliminar este servicio? Si ya tiene citas, solo se ocultará.")) return;
    startTransition(async () => {
      const res = await deleteService(editing.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.deactivated ? "Servicio oculto (tiene citas)" : "Servicio eliminado");
      onClose();
    });
  }

  return (
    <Sheet open={editing !== null} onOpenChange={(o) => (!o ? onClose() : null)}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        <form onSubmit={submit} className="flex flex-1 flex-col">
          <SheetHeader className="p-6 pb-2">
            <SheetTitle>{isNew ? "Nuevo servicio" : "Editar servicio"}</SheetTitle>
            <SheetDescription>Así lo verán tus pacientes al agendar.</SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 p-6 pt-4">
            <Field label="Nombre" error={errors.name}>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Primera consulta"
                autoFocus
                aria-invalid={!!errors.name}
              />
            </Field>

            <Field label="Descripción (opcional)" error={errors.description}>
              <Textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Qué incluye, para quién es, qué debe traer…"
                rows={3}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Duración (min)" error={errors.durationMin}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={10}
                  max={480}
                  step={5}
                  value={form.durationMin}
                  onChange={(e) => set("durationMin", e.target.value)}
                  aria-invalid={!!errors.durationMin}
                />
              </Field>
              <Field label="Precio (MXN)" error={errors.priceMxn}>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    className="pl-8"
                    value={form.priceMxn}
                    onChange={(e) => set("priceMxn", e.target.value)}
                    placeholder="0"
                    aria-invalid={!!errors.priceMxn}
                  />
                </div>
              </Field>
            </div>

            <Field label="Modalidad" error={errors.modality}>
              <Select value={form.modality} onValueChange={(v) => set("modality", v as Modality)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODALITY_LABEL) as Modality[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MODALITY_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {form.modality !== "online" ? (
              <Field label="Ubicación del consultorio" error={errors.location}>
                <Input
                  value={form.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Av. Reforma 123, Col. Juárez, CDMX"
                  aria-invalid={!!errors.location}
                />
              </Field>
            ) : null}

            <Field label="Cobro" error={errors.paymentMode} hint="El pago en línea se habilita en Cobros.">
              <Select value={form.paymentMode} onValueChange={(v) => set("paymentMode", v as PaymentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYMENT_MODE_LABEL) as PaymentMode[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {PAYMENT_MODE_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="flex items-center justify-between rounded-xl border border-border p-4">
              <div>
                <p className="text-sm font-semibold">Visible en tu página</p>
                <p className="text-xs text-muted-foreground">Si lo apagas, nadie podrá agendarlo.</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
            </div>
          </div>

          <SheetFooter className="sticky bottom-0 flex-row gap-2 border-t border-border bg-card p-4">
            {!isNew ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={remove} disabled={pending}>
                <Trash2 /> Eliminar
              </Button>
            ) : null}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
                Cancelar
              </Button>
              <Button type="submit" loading={pending}>
                {isNew ? "Crear" : "Guardar"}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
