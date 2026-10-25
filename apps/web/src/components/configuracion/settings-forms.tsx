"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { authClient } from "@granola/auth/client";
import {
  Button,
  DataList,
  DataRow,
  FormField,
  Input,
  SectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  toast,
} from "@granola/ui";
import {
  exportAccount,
  saveAccount,
} from "@/app/(panel)/app/configuracion/actions";
import { updateTimezone } from "@/app/(panel)/app/agenda/actions";
import { LATAM_TIMEZONES } from "@/components/agenda/timezones";
import { accountSchema, passwordSchema } from "./schemas";

type Setting = "profile" | "password" | "timezone" | "export";
const TITLES: Record<Setting, string> = {
  profile: "Perfil de cuenta",
  password: "Cambiar contraseña",
  timezone: "Zona horaria",
  export: "Exportar mis datos",
};
const DESCRIPTIONS: Record<Setting, string> = {
  profile: "El nombre de tu cuenta en Granola.",
  password: "Usa al menos 8 caracteres.",
  timezone: "La zona que usa tu agenda.",
  export: "Descarga una copia de tu información.",
};

function SettingRow({
  label,
  value,
  onClick,
  disabled,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <DataRow className="py-0">
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="flex min-h-16 w-full items-center justify-between gap-4 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:min-h-12 md:py-3"
        >
          <span className="min-w-0 flex-1 md:flex md:items-center md:gap-4">
            <span className="block text-base font-medium md:w-40 md:shrink-0">
              {label}
            </span>
            {value ? (
              <span className="mt-1 block truncate text-sm text-muted-foreground md:mt-0">
                {value}
              </span>
            ) : null}
          </span>
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        </button>
      ) : (
        <div className="flex min-h-16 w-full flex-wrap items-center justify-between gap-2 py-3 md:min-h-12">
          <span className="font-medium">{label}</span>
          <span className="text-sm text-muted-foreground">{value}</span>
        </div>
      )}
    </DataRow>
  );
}

export function SettingsForms(props: {
  name: string;
  email: string;
  timezone: string;
}) {
  const router = useRouter();
  const passwordForm = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [timezone, setTimezone] = useState(props.timezone);
  const [name, setName] = useState(props.name);
  const [editing, setEditing] = useState<Setting | null>(null);
  const zoneName =
    LATAM_TIMEZONES.find((zone) => zone.value === timezone)?.label ??
    timezone.split("/").at(-1)?.replace(/_/g, " ") ??
    timezone;
  function run(work: () => Promise<void>) {
    startTransition(async () => {
      try {
        await work();
      } catch {
        toast.error("No se pudo completar. Intenta de nuevo.");
      }
    });
  }
  return (
    <div className="grid gap-8">
      <section className="grid gap-3">
        <SectionHeader title="Cuenta" />
        <DataList>
          <SettingRow
            label="Perfil"
            value={`${name} · ${props.email}`}
            onClick={() => setEditing("profile")}
          />
          <SettingRow
            label="Contraseña"
            value="Cambiar contraseña"
            onClick={() => setEditing("password")}
          />
          <SettingRow
            label="Cerrar sesión"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const result = await authClient.signOut();
                if (result.error) {
                  toast.error("No se pudo cerrar sesión");
                  return;
                }
                router.replace("/login");
                router.refresh();
              })
            }
          />
        </DataList>
      </section>
      <section className="grid gap-3">
        <SectionHeader title="Preferencias" />
        <DataList>
          <SettingRow
            label="Zona horaria"
            value={zoneName}
            onClick={() => setEditing("timezone")}
          />
          <SettingRow label="Idioma" value="Español (México)" />
        </DataList>
      </section>
      <section className="grid gap-3">
        <SectionHeader title="Datos y privacidad" />
        <DataList>
          <DataRow className="py-0">
            <Link
              className="flex min-h-16 w-full items-center justify-between gap-4 py-3 font-medium md:min-h-12"
              href="/privacidad"
            >
              Aviso de privacidad
              <ChevronRight
                className="size-4 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </DataRow>
          <SettingRow
            label="Exportar mis datos"
            value="Copia en JSON"
            onClick={() => setEditing("export")}
          />
        </DataList>
      </section>
      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <SheetContent side="bottom" className="mx-auto max-w-lg">
          <SheetHeader>
            <SheetTitle>
              {editing ? TITLES[editing] : "Configuración"}
            </SheetTitle>
            <SheetDescription>
              {editing ? DESCRIPTIONS[editing] : ""}
            </SheetDescription>
          </SheetHeader>
          {editing === "profile" ? (
            <form
              className="grid gap-4"
              action={(form) =>
                run(async () => {
                  const parsed = accountSchema.safeParse(
                    Object.fromEntries(form),
                  );
                  if (!parsed.success) {
                    toast.error(parsed.error.issues[0]!.message);
                    return;
                  }
                  const result = await saveAccount(parsed.data);
                  if (result.ok) {
                    setName(parsed.data.name);
                    setEditing(null);
                    toast.success("Nombre actualizado");
                    router.refresh();
                  } else toast.error(result.error);
                })
              }
            >
              <FormField label="Nombre">
                <Input
                  name="name"
                  defaultValue={name}
                  required
                  minLength={2}
                  maxLength={60}
                />
              </FormField>
              <FormField label="Correo electrónico">
                <Input value={props.email} readOnly type="email" />
              </FormField>
              <Button type="submit" disabled={pending}>
                Guardar
              </Button>
            </form>
          ) : null}
          {editing === "password" ? (
            <form
              className="grid gap-4"
              action={(form) =>
                run(async () => {
                  const parsed = passwordSchema.safeParse(
                    Object.fromEntries(form),
                  );
                  if (!parsed.success) {
                    toast.error(parsed.error.issues[0]!.message);
                    return;
                  }
                  const result = await authClient.changePassword({
                    currentPassword: parsed.data.currentPassword,
                    newPassword: parsed.data.newPassword,
                    revokeOtherSessions: true,
                  });
                  if (result.error) {
                    toast.error(
                      "No se pudo cambiar la contraseña. Revisa tu contraseña actual.",
                    );
                    return;
                  }
                  toast.success("Contraseña actualizada");
                  passwordForm.current?.reset();
                  setEditing(null);
                })
              }
              ref={passwordForm}
            >
              <FormField label="Contraseña actual">
                <Input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </FormField>
              <FormField label="Nueva contraseña">
                <Input
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                />
              </FormField>
              <FormField label="Confirma tu nueva contraseña">
                <Input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </FormField>
              <Button type="submit" disabled={pending}>
                Cambiar contraseña
              </Button>
            </form>
          ) : null}
          {editing === "timezone" ? (
            <FormField label="Zona horaria">
              <Select
                value={timezone}
                disabled={pending}
                onValueChange={(value) =>
                  run(async () => {
                    const result = await updateTimezone(value);
                    if (result.ok) {
                      setTimezone(value);
                      setEditing(null);
                      toast.success("Zona horaria actualizada");
                    } else toast.error(result.error);
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!LATAM_TIMEZONES.some((zone) => zone.value === timezone) ? (
                    <SelectItem value={timezone}>{zoneName}</SelectItem>
                  ) : null}
                  {LATAM_TIMEZONES.map((zone) => (
                    <SelectItem key={zone.value} value={zone.value}>
                      {zone.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          ) : null}
          {editing === "export" ? (
            <div className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                Incluye tu perfil, servicios, disponibilidad, pacientes, citas y
                pagos. Contiene datos de salud: guarda el archivo en un lugar
                seguro. La descarga queda registrada.
              </p>
              <Button
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const json = await exportAccount();
                    const url = URL.createObjectURL(
                      new Blob([json], { type: "application/json" }),
                    );
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "granola-mis-datos.json";
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  })
                }
              >
                Descargar JSON
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
