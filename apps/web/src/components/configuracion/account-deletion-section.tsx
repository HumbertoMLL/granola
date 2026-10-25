"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@granola/auth/client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  toast,
} from "@granola/ui";

import { requestAccountDeletion } from "@/app/(panel)/app/configuracion/account-deletion";

import {
  ACCOUNT_DELETION_GRACE_DAYS,
  requestAccountDeletionSchema,
} from "./account-deletion-schema";

/** Sección "Datos y privacidad" → Eliminar cuenta (borrado lógico, ADR 0015). */
export function AccountDeletionSection({
  hasPassword,
}: {
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    const parsed = requestAccountDeletionSchema.safeParse({
      password,
      confirmation,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    startTransition(async () => {
      try {
        const result = await requestAccountDeletion(parsed.data);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        // El servidor ya revocó todas las sesiones; signOut limpia la cookie de este navegador.
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      } catch {
        toast.error("No se pudo completar. Intenta de nuevo.");
      }
    });
  }

  return (
    <section className="border-t border-border pt-4">
      <details className="text-sm text-muted-foreground">
        <summary className="w-fit cursor-pointer">
          Sobre la eliminación de tu cuenta
        </summary>
        <div className="mt-3 grid gap-3">
          <p>
            Al eliminar tu cuenta, tu página pública deja de verse de inmediato,
            cancelamos tus citas futuras (tus pacientes reciben un WhatsApp) y
            se cierra tu sesión en todos tus dispositivos.
          </p>
          <p>
            Tienes {ACCOUNT_DELETION_GRACE_DAYS} días para arrepentirte: entra
            con tu correo y contraseña y toca «Cancelar eliminación». Pasado ese
            plazo borramos tus datos de contacto y los de tus pacientes, tu foto
            y tus accesos.
          </p>
          <p>
            Lo que la ley nos obliga a guardar se conserva de forma anónima y
            bloqueada: el expediente clínico (NOM-004 pide 5 años) y los
            registros de citas y pagos (SAT). Nadie puede verlos desde la app.
          </p>
        </div>
      </details>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="mt-3 -ml-3 text-destructive-ink hover:bg-status-cancelled-soft"
            disabled={!hasPassword}
          >
            Eliminar mi cuenta
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar tu cuenta?</DialogTitle>
            <DialogDescription>
              Se eliminará en {ACCOUNT_DELETION_GRACE_DAYS} días. Hasta entonces
              puedes cancelarlo entrando a Granola. Tus citas futuras se
              cancelan hoy y no se restauran si cancelas la eliminación.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="delete-password">Tu contraseña</Label>
              <Input
                id="delete-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="delete-confirmation">
                Escribe ELIMINAR para confirmar
              </Label>
              <Input
                id="delete-confirmation"
                autoComplete="off"
                autoCapitalize="characters"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive-ink">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="destructive"
              className="h-auto min-h-11 whitespace-normal py-2"
              disabled={
                pending || confirmation !== "ELIMINAR" || password.length === 0
              }
              loading={pending}
            >
              Eliminar mi cuenta en {ACCOUNT_DELETION_GRACE_DAYS} días
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {!hasPassword ? (
        <p className="text-sm text-muted-foreground">
          Tu cuenta no tiene contraseña (entras con Google o con enlace por
          correo), y pedimos la contraseña para confirmar que eres tú. Por
          ahora, para eliminar este tipo de cuenta escríbele a soporte de
          Granola.
        </p>
      ) : null}
    </section>
  );
}
