"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@granola/auth/client";
import { Button, toast } from "@granola/ui";

import { cancelAccountDeletion } from "@/app/(panel)/app/configuracion/account-deletion";

export function PendingDeletionActions({ canCancel }: { canCancel: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      {canCancel ? (
        <Button
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                const result = await cancelAccountDeletion();
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Listo, tu cuenta sigue activa");
                router.replace("/app");
                router.refresh();
              } catch {
                toast.error("No se pudo cancelar. Intenta de nuevo.");
              }
            })
          }
        >
          Cancelar eliminación
        </Button>
      ) : null}
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await authClient.signOut();
            router.replace("/login");
            router.refresh();
          })
        }
      >
        Cerrar sesión
      </Button>
    </div>
  );
}
