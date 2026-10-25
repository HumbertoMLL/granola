/** Formateadores puros compartidos entre panel y booking público. */

import { addDaysYmd, ymdInTz } from "@granola/core/scheduling";
import { LATAM_TIMEZONES } from "@/components/agenda/timezones";

export function formatPrice(cents: number, currency = "MXN"): string {
  if (cents === 0) return "Gratis";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Etiqueta para personas; el identificador IANA se conserva solo como valor. */
export function formatTimezone(timezone: string): string {
  const label = LATAM_TIMEZONES.find((zone) => zone.value === timezone)?.label;
  return label
    ? label.replace(/\s*\([^)]*\)/g, "")
    : (timezone.split("/").at(-1) ?? timezone).replace(/_/g, " ");
}

/** Fecha breve en la zona elegida. `now` evita diferencias de hidratación. */
export function formatShortDate(date: Date, timezone: string, now?: Date): string {
  const day = ymdInTz(date, timezone);
  if (now) {
    const today = ymdInTz(now, timezone);
    if (day === today) return "hoy";
    if (day === addDaysYmd(today, 1)) return "mañana";
  }
  return new Intl.DateTimeFormat("es-MX", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).formatToParts(date)
    .filter((part) => part.type === "weekday" || part.type === "day" || part.type === "month")
    .map((part) => part.value.replace(/\./g, ""))
    .join(" ");
}

/** Un día de calendario no cambia al convertir la zona del navegador. */
export function formatCalendarDate(day: string): string {
  return formatShortDate(new Date(`${day}T12:00:00Z`), "UTC");
}

export type Modality = "online" | "presencial" | "ambas";
export type AppointmentModality = "online" | "presencial";
export type PaymentMode = "prepaid" | "at_visit" | "optional";
export type AppointmentStatus = "pending_payment" | "confirmed" | "cancelled" | "no_show" | "completed";

export const MODALITY_LABEL: Record<Modality, string> = {
  online: "En línea",
  presencial: "Presencial",
  ambas: "En línea o presencial",
};

export const PAYMENT_MODE_LABEL: Record<PaymentMode, string> = {
  prepaid: "Pago anticipado",
  at_visit: "Se paga en consulta",
  optional: "Pago opcional al agendar",
};

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending_payment: "Pendiente de pago",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  no_show: "No asistió",
  completed: "Completada",
};

export const STATUS_BADGE_VARIANT: Record<
  AppointmentStatus,
  "confirmed" | "pending" | "done" | "cancelled"
> = {
  pending_payment: "pending",
  confirmed: "confirmed",
  cancelled: "cancelled",
  no_show: "done",
  completed: "done",
};
