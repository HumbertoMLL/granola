/** Tipos del payload de Meta Cloud API (subconjunto que usamos). */

export const TEMPLATE_NAMES = [
  "cita_confirmada",
  "recordatorio_24h",
  "recordatorio_2h",
  "cita_cancelada",
  "cita_reagendada",
  "pago_pendiente_oxxo",
  "pide_resena",
  "nueva_cita_nutri",
  "reporte_listo",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export type TemplateLanguage = "es_MX";

export type TextParameter = { type: "text"; text: string };
export type PayloadParameter = { type: "payload"; payload: string };

export type BodyComponent = { type: "body"; parameters: TextParameter[] };

export type UrlButtonComponent = {
  type: "button";
  sub_type: "url";
  /** Posición del botón en la plantilla registrada en Meta (0-based, como string). */
  index: string;
  parameters: TextParameter[];
};

export type QuickReplyButtonComponent = {
  type: "button";
  sub_type: "quick_reply";
  index: string;
  parameters: PayloadParameter[];
};

export type TemplateComponent = BodyComponent | UrlButtonComponent | QuickReplyButtonComponent;

/** Lo que devuelve cada builder de `src/templates/*`. */
export type TemplateMessage = {
  name: TemplateName;
  language: TemplateLanguage;
  components: TemplateComponent[];
};

/** Resultado de un envío (real o dry run). */
export type SendResult = {
  /** `wamid.…` que devuelve Meta. Null en dry run. */
  waMessageId: string | null;
  dryRun: boolean;
  /** Cuerpo exacto que se mandó (o se habría mandado) a Graph. Se guarda en wa_messages.payload. */
  request: Record<string, unknown>;
  /** Respuesta cruda de Graph (solo envío real). */
  response?: Record<string, unknown>;
};

export class WhatsAppApiError extends Error {
  readonly httpStatus: number;
  readonly code: number | undefined;
  readonly subcode: number | undefined;
  readonly details: unknown;
  /** true si vale la pena reintentar (5xx, 429, red). */
  readonly retriable: boolean;

  constructor(message: string, opts: { httpStatus: number; code?: number; subcode?: number; details?: unknown }) {
    super(message);
    this.name = "WhatsAppApiError";
    this.httpStatus = opts.httpStatus;
    this.code = opts.code;
    this.subcode = opts.subcode;
    this.details = opts.details;
    // 130429 = rate limit de Meta; 131056 = pair rate limit.
    this.retriable =
      opts.httpStatus >= 500 || opts.httpStatus === 429 || opts.code === 130429 || opts.code === 131056 || opts.code === 2;
  }
}
