/** Helpers de formato para cobros. Sin IO; se usan en servidor y cliente. */

export function formatMoney(cents: number, currency = "MXN"): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDateTime(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(d);
}

export function formatDate(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone,
  }).format(d);
}

/** "2026-10" → "octubre 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1));
  const label = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    ...(d.getUTCFullYear() !== new Date().getUTCFullYear()
      ? { year: "numeric" as const }
      : {}),
    timeZone: "UTC",
  }).format(d);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Mes actual "YYYY-MM" en la zona del nutri. */
export function currentMonth(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone,
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

/** Últimos N meses (incluido el actual), más recientes primero. */
export function recentMonths(
  timeZone: string,
  count = 12,
  now = new Date(),
): string[] {
  const [y0, m0] = currentMonth(timeZone, now).split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(y0 ?? 1970, (m0 ?? 1) - 1 - i, 1));
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
    );
  }
  return out;
}

/**
 * Offset en minutos de `timeZone` respecto a UTC en la fecha dada (negativo al
 * oeste: CDMX = -360). Sirve para que "1 de octubre 00:00" sea en hora del nutri.
 */
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** Ancla UTC del mes para calcular el offset; el inicio de mes en la tz es UTC00 − offset. */
export function monthOffsetMinutes(month: string, timeZone: string): number {
  const [y, m] = month.split("-").map(Number);
  const anchor = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1, 12));
  return -tzOffsetMinutes(timeZone, anchor);
}

export const STATUS_LABEL = {
  pending: "Pendiente",
  paid: "Pagado",
  failed: "Falló",
  expired: "Expiró",
  refunded: "Reembolsado",
} as const;

/** `payments.failure_reason` → texto para el nutri. */
export function failureReasonLabel(reason: string | null): string | null {
  if (!reason) return null;
  if (reason === "appointment_expired")
    return "No se pagó a tiempo; el horario se liberó";
  if (reason === "stripe:session_expired")
    return "El paciente no completó el pago con tarjeta";
  if (reason === "stripe:async_payment_failed")
    return "El banco rechazó el pago";
  if (reason === "mp:expired")
    return "La referencia SPEI/OXXO venció sin pagarse";
  if (reason.startsWith("mp:cc_rejected") || reason === "mp:rejected")
    return "Mercado Pago rechazó el pago";
  return reason;
}

export const METHOD_LABEL = {
  card: "Tarjeta",
  spei: "SPEI",
  oxxo: "OXXO",
  cash: "Efectivo",
} as const;
