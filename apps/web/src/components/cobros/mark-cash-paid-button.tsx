"use client";

import { useActionState, useEffect } from "react";
import { Banknote } from "lucide-react";

import { Button, toast } from "@granola/ui";

import { markCashPaidAction, type ActionState } from "@/app/(panel)/app/cobros/actions";

const initial: ActionState = {};

export function MarkCashPaidButton({ appointmentId, amountCents }: { appointmentId: string; amountCents: number }) {
  const [state, action, pending] = useActionState(markCashPaidAction, initial);

  useEffect(() => {
    if (state.ok) toast.success("Pago en efectivo registrado");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action}>
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="amountCents" value={amountCents} />
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        <Banknote /> Marcar pagado en efectivo
      </Button>
    </form>
  );
}
