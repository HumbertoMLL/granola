import Link from "next/link";
import { EmptyState, Button } from "@granola/ui";
import type { PaymentListItem } from "@granola/payments";

import {
  failureReasonLabel,
  formatDate,
  formatDateTime,
  formatMoney,
} from "./format";
import { MethodIcon, StatusBadge } from "./method-icon";

/**
 * Lista de pagos. En móvil cada pago es una tarjeta (el nutri consulta desde el
 * celular); en md+ se vuelve tabla. Un solo markup con grid para no duplicar.
 */
export function PaymentsTable({
  items,
  timeZone,
}: {
  items: PaymentListItem[];
  timeZone: string;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Sin cobros este mes"
        description="Cuando un paciente pague una cita, aparecerá aquí."
        action={
          <Button variant="outline" asChild>
            <Link href="/app/agenda">Ver agenda</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden border-y border-border">
      <div className="hidden grid-cols-[1.1fr_1.4fr_1.4fr_1fr_1fr_1fr] gap-3 border-b border-border px-0 py-3 text-xs font-semibold tracking-wide text-muted-foreground md:grid">
        <span>Fecha</span>
        <span>Paciente</span>
        <span>Servicio</span>
        <span>Método</span>
        <span className="text-right">Monto</span>
        <span className="text-right">Estado</span>
      </div>
      <ul className="divide-y divide-border">
        {items.map((p) => (
          <li
            key={p.id}
            className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 px-0 py-3 md:grid-cols-[1.1fr_1.4fr_1.4fr_1fr_1fr_1fr] md:items-center md:gap-3"
          >
            {/* Móvil: paciente + monto arriba; servicio, método y fecha abajo */}
            <p className="truncate font-medium md:order-2">{p.patientName}</p>
            <p className="text-right font-semibold tabular-nums md:order-5">
              {formatMoney(p.amountCents, p.currency)}
            </p>
            <p className="truncate text-sm text-muted-foreground md:order-3 md:text-foreground">
              {p.serviceName}
              <span className="md:hidden">
                {" "}
                · cita {formatDateTime(p.appointmentStartsAt, timeZone)}
              </span>
            </p>
            <div
              className="flex items-center justify-end gap-2 md:order-6"
              title={failureReasonLabel(p.failureReason) ?? undefined}
            >
              <StatusBadge status={p.status} />
            </div>
            <div className="col-span-2 flex items-center justify-between text-sm md:col-span-1 md:order-4 md:justify-start">
              <MethodIcon method={p.method} />
              <span className="text-xs text-muted-foreground md:hidden">
                {p.paidAt
                  ? `Pagado ${formatDate(p.paidAt, timeZone)}`
                  : formatDate(p.createdAt, timeZone)}
              </span>
            </div>
            <p
              className="hidden text-sm text-muted-foreground md:order-1 md:block"
              title={p.createdAt.toISOString()}
            >
              {formatDateTime(p.paidAt ?? p.createdAt, timeZone)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
