import type {
  BodyComponent,
  QuickReplyButtonComponent,
  TemplateMessage,
  TemplateName,
  UrlButtonComponent,
} from "../types";

/**
 * Meta rechaza parámetros con saltos de línea, tabs o más de 4 espacios
 * seguidos (error 132018). Aquí se limpian y se recortan.
 */
export function param(value: string | number, max = 1024): string {
  const s = String(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s || "-";
}

export function body(...values: (string | number)[]): BodyComponent {
  return { type: "body", parameters: values.map((v) => ({ type: "text", text: param(v) })) };
}

/** Botón URL con sufijo dinámico: la plantilla tiene `https://dominio/ruta/{{1}}`. */
export function urlButton(index: number, suffix: string): UrlButtonComponent {
  return { type: "button", sub_type: "url", index: String(index), parameters: [{ type: "text", text: param(suffix, 2000) }] };
}

/** Botón de respuesta rápida; `payload` regresa en el webhook (`messages[].button.payload`). */
export function quickReply(index: number, payload: string): QuickReplyButtonComponent {
  return { type: "button", sub_type: "quick_reply", index: String(index), parameters: [{ type: "payload", payload }] };
}

export function template(name: TemplateName, components: TemplateMessage["components"]): TemplateMessage {
  return { name, language: "es_MX", components };
}

export type Modality = "online" | "presencial";

export function modalityLabel(m: Modality): string {
  return m === "online" ? "en línea" : "presencial";
}

/**
 * {{detalle}} de la cita: para online el link de Meet; para presencial la
 * dirección. Siempre devuelve algo porque Meta no acepta parámetros vacíos.
 */
export function modalityDetail(m: Modality, meetUrl: string | null | undefined, location: string | null | undefined): string {
  if (m === "online") return meetUrl ? `Te conectas aquí: ${meetUrl}` : "Te mandaremos el link de la videollamada antes de la cita.";
  return location ? `Dirección: ${location}` : "Consulta presencial.";
}

/** Payloads de quick reply que entiende el parser de webhooks. */
export const QUICK_REPLY = {
  confirm: (appointmentId: string) => `confirm:${appointmentId}`,
  reschedule: (appointmentId: string) => `reschedule:${appointmentId}`,
} as const;
