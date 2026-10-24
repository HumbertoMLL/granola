import type { PaymentListItem } from "@granola/payments";

import { formatDate, formatDateTime, formatMoney } from "./format";
import { MethodIcon, StatusBadge } from "./method-icon";

/**
 * Lista de pagos. En móvil cada pago es una tarjeta (el nutri consulta desde el
 * celular); en md+ se vuelve tabla. Un solo markup con grid para no duplicar.
 */
export function PaymentsTable({ items, timeZone }: { items: PaymentListItem[]; timeZone: string }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border px-4 py-10 text-center">
        <p className="text-sm font-medium">Sin cobros este mes</p>
        <p className="text-sm text-muted-foreground">
          Cuando un paciente pague una cita, aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div
        role="row"
        className="hidden grid-cols-[1.1fr_1.4fr_1.4fr_1fr_1fr_1fr] gap-3 border-b border-border bg-secondary/60 px-4 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase md:grid"
      >
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
            className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[1.1fr_1.4fr_1.4fr_1fr_1fr_1fr] md:items-center md:gap-3"
          >
            {/* Móvil: paciente + monto arriba; servicio, método y fecha abajo */}
            <p className="truncate font-medium md:order-2">{p.patientName}</p>
            <p className="text-right font-semibold tabular-nums md:order-5">
              {formatMoney(p.amountCents, p.currency)}
            </p>
            <p className="truncate text-sm text-muted-foreground md:order-3 md:text-foreground">
              {p.serviceName}
              <span className="md:hidden"> · cita {formatDateTime(p.appointmentStartsAt, timeZone)}</span>
            </p>
            <div className="flex items-center justify-end gap-2 md:order-6">
              <StatusBadge status={p.status} />
            </div>
            <div className="col-span-2 flex items-center justify-between text-sm md:col-span-1 md:order-4 md:justify-start">
              <MethodIcon method={p.method} />
              <span className="text-xs text-muted-foreground md:hidden">
                {p.paidAt ? `Pagado ${formatDate(p.paidAt, timeZone)}` : formatDate(p.createdAt, timeZone)}
              </span>
            </div>
            <p className="hidden text-sm text-muted-foreground md:order-1 md:block" title={p.createdAt.toISOString()}>
              {formatDateTime(p.paidAt ?? p.createdAt, timeZone)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
