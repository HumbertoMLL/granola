/** Formateadores puros compartidos entre panel y booking público. */

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
  "default" | "accent" | "secondary" | "destructive" | "outline" | "solid"
> = {
  pending_payment: "accent",
  confirmed: "default",
  cancelled: "destructive",
  no_show: "secondary",
  completed: "outline",
};
