"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@granola/auth/client";
import { Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@granola/ui";
import { exportAccount, saveAccount } from "@/app/(panel)/app/configuracion/actions";
import { updateTimezone } from "@/app/(panel)/app/agenda/actions";
import { LATAM_TIMEZONES } from "@/components/agenda/timezones";
import { accountSchema, passwordSchema } from "./schemas";

export function SettingsForms(props: { name: string; email: string; timezone: string }) {
  const router = useRouter();
  const passwordForm = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [timezone, setTimezone] = useState(props.timezone);
  function run(work: () => Promise<void>) {
    startTransition(async () => { try { await work(); } catch { toast.error("No se pudo completar. Intenta de nuevo."); } });
  }
  return <div className="grid gap-6">
    <Card>
      <h2 className="text-lg font-semibold">Perfil de cuenta</h2>
      <form className="grid gap-3" action={(form) => run(async () => {
        const parsed = accountSchema.safeParse(Object.fromEntries(form));
        if (!parsed.success) { toast.error(parsed.error.issues[0]!.message); return; }
        const result = await saveAccount(parsed.data);
        if (result.ok) toast.success("Nombre actualizado"); else toast.error(result.error);
      })}>
        <Label htmlFor="account-name">Nombre</Label><Input id="account-name" name="name" defaultValue={props.name} required minLength={2} maxLength={60} />
        <Label htmlFor="account-email">Correo electrónico</Label><Input id="account-email" value={props.email} readOnly type="email" />
        <Button type="submit" disabled={pending}>Guardar nombre</Button>
      </form>
      <form className="grid gap-3 border-t border-border pt-4" action={(form) => run(async () => {
        const parsed = passwordSchema.safeParse(Object.fromEntries(form));
        if (!parsed.success) { toast.error(parsed.error.issues[0]!.message); return; }
        const result = await authClient.changePassword({ currentPassword: parsed.data.currentPassword, newPassword: parsed.data.newPassword, revokeOtherSessions: true });
        if (result.error) { toast.error("No se pudo cambiar la contraseña. Revisa tu contraseña actual."); return; }
        toast.success("Contraseña actualizada");
        passwordForm.current?.reset();
      })} ref={passwordForm}>
        <h3 className="font-medium">Cambiar contraseña</h3>
        <Label htmlFor="current-password">Contraseña actual</Label><Input id="current-password" name="currentPassword" type="password" autoComplete="current-password" required />
        <Label htmlFor="new-password">Nueva contraseña</Label><Input id="new-password" name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required />
        <Label htmlFor="confirm-password">Confirma tu nueva contraseña</Label><Input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required />
        <Button type="submit" variant="outline" disabled={pending}>Cambiar contraseña</Button>
      </form>
      <Button variant="ghost" disabled={pending} onClick={() => run(async () => {
        const result = await authClient.signOut();
        if (result.error) { toast.error("No se pudo cerrar sesión"); return; }
        router.replace("/login"); router.refresh();
      })}>Cerrar sesión</Button>
    </Card>
    <Card>
      <h2 className="text-lg font-semibold">Preferencias</h2>
      <Label htmlFor="settings-timezone">Zona horaria</Label>
      <Select value={timezone} disabled={pending} onValueChange={(value) => run(async () => {
        const result = await updateTimezone(value);
        if (result.ok) { setTimezone(value); toast.success("Zona horaria actualizada"); } else toast.error(result.error);
      })}>
        <SelectTrigger id="settings-timezone"><SelectValue /></SelectTrigger>
        <SelectContent>{!LATAM_TIMEZONES.some((t) => t.value === timezone) ? <SelectItem value={timezone}>{timezone}</SelectItem> : null}{LATAM_TIMEZONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
      </Select>
      <Label htmlFor="settings-language">Idioma</Label><Input id="settings-language" readOnly value="Español (México) · es-MX" />
    </Card>
    <Card>
      <h2 className="text-lg font-semibold">Datos y privacidad</h2>
      <Link className="text-primary underline" href="/privacidad">Leer aviso de privacidad</Link>
      <p className="text-sm text-muted-foreground">Descarga en JSON tu perfil, servicios, disponibilidad, pacientes, citas y pagos. Incluye datos de salud de tus pacientes: guárdalo en un lugar seguro. Cada descarga queda registrada.</p>
      <Button variant="outline" disabled={pending} onClick={() => run(async () => {
        const json = await exportAccount();
        const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        const link = document.createElement("a"); link.href = url; link.download = "granola-mis-datos.json"; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })}>Exportar mis datos</Button>
    </Card>
  </div>;
}
