import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fromWaId } from "./phone";

// ───────────────────────── Verificación GET ─────────────────────────

/**
 * Meta llama GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
 * Devuelve el challenge a responder (texto plano, 200) o null si no coincide.
 */
export function verifyWebhookChallenge(params: URLSearchParams, verifyToken: string | undefined): string | null {
  if (!verifyToken) return null;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || !challenge || !token) return null;
  return safeEqual(token, verifyToken) ? challenge : null;
}

// ───────────────────────── Firma POST ─────────────────────────

/**
 * Valida `X-Hub-Signature-256: sha256=<hmac hex>` sobre el body CRUDO con WA_APP_SECRET.
 * Importante: el body debe ser el texto exacto, no el JSON re-serializado.
 */
export function verifySignature(rawBody: string | Uint8Array, signatureHeader: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !signatureHeader) return false;
  const [algo, hex] = signatureHeader.split("=", 2);
  if (algo !== "sha256" || !hex) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqual(hex, expected);
}

export function signPayload(rawBody: string, appSecret: string): string {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// ───────────────────────── Schema del payload ─────────────────────────

const statusSchema = z.looseObject({
  id: z.string(),
  status: z.enum(["sent", "delivered", "read", "failed", "deleted", "warning"]),
  timestamp: z.string(),
  recipient_id: z.string(),
  errors: z
    .array(z.looseObject({ code: z.number(), title: z.string().optional(), message: z.string().optional(), error_data: z.unknown().optional() }))
    .optional(),
});

const messageSchema = z.looseObject({
  from: z.string(),
  id: z.string(),
  timestamp: z.string(),
  type: z.string(),
  text: z.looseObject({ body: z.string() }).optional(),
  button: z.looseObject({ payload: z.string().optional(), text: z.string().optional() }).optional(),
  interactive: z
    .looseObject({
      type: z.string(),
      button_reply: z.looseObject({ id: z.string(), title: z.string() }).optional(),
      list_reply: z.looseObject({ id: z.string(), title: z.string() }).optional(),
    })
    .optional(),
  context: z.looseObject({ from: z.string().optional(), id: z.string().optional() }).optional(),
});

const valueSchema = z.looseObject({
  messaging_product: z.literal("whatsapp").optional(),
  metadata: z.looseObject({ display_phone_number: z.string().optional(), phone_number_id: z.string().optional() }).optional(),
  contacts: z.array(z.looseObject({ wa_id: z.string(), profile: z.looseObject({ name: z.string().optional() }).optional() })).optional(),
  messages: z.array(messageSchema).optional(),
  statuses: z.array(statusSchema).optional(),
});

export const webhookPayloadSchema = z.looseObject({
  object: z.string(),
  entry: z.array(
    z.looseObject({
      id: z.string(),
      changes: z.array(z.looseObject({ field: z.string(), value: valueSchema })),
    }),
  ),
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

// ───────────────────────── Resultado parseado ─────────────────────────

export type WaDeliveryStatus = "sent" | "delivered" | "read" | "failed";

export type StatusUpdate = {
  waMessageId: string;
  status: WaDeliveryStatus;
  /** E.164 del destinatario (null si no es MX). */
  recipient: string | null;
  recipientRaw: string;
  timestamp: Date;
  errorCode: string | null;
  errorTitle: string | null;
  raw: Record<string, unknown>;
};

export type InboundIntent =
  | { kind: "confirm"; appointmentId: string | null }
  | { kind: "reschedule"; appointmentId: string | null };

export type InboundMessage = {
  waMessageId: string;
  /** E.164 del remitente (null si no se pudo normalizar como MX). */
  from: string | null;
  fromRaw: string;
  profileName: string | null;
  timestamp: Date;
  type: string;
  /** Texto del mensaje, del botón o del interactive reply. */
  text: string | null;
  buttonPayload: string | null;
  /** wamid del mensaje nuestro al que responde (si es respuesta a plantilla). */
  contextMessageId: string | null;
  intent: InboundIntent | null;
  /** phone_number_id del número que recibió (útil en F2 con varios números). */
  phoneNumberId: string | null;
  raw: Record<string, unknown>;
};

export type ParsedWebhook = {
  statuses: StatusUpdate[];
  inbound: InboundMessage[];
};

const UUID_RE = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const PAYLOAD_RE = new RegExp(`^(confirm|reschedule):(${UUID_RE})$`);

const CONFIRM_WORDS = new Set(["confirmo", "confirmar", "confirmado", "confirmada", "si", "sí", "si confirmo", "sí confirmo", "ok", "va", "listo"]);
const RESCHEDULE_WORDS = new Set(["reagendar", "reagenda", "cambiar", "cambiar cita", "mover", "mover cita", "reprogramar", "cancelar"]);

function normalizeWord(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detecta la intención a partir del payload del botón o del texto. */
export function detectIntent(buttonPayload: string | null, text: string | null): InboundIntent | null {
  if (buttonPayload) {
    const m = PAYLOAD_RE.exec(buttonPayload);
    if (m) return { kind: m[1] as "confirm" | "reschedule", appointmentId: m[2] ?? null };
  }
  if (!text) return null;
  const w = normalizeWord(text);
  const bare = w.replace(/\s/g, "");
  if (CONFIRM_WORDS.has(w) || CONFIRM_WORDS.has(bare)) return { kind: "confirm", appointmentId: null };
  if (RESCHEDULE_WORDS.has(w) || RESCHEDULE_WORDS.has(bare)) return { kind: "reschedule", appointmentId: null };
  return null;
}

/**
 * Convierte el JSON del webhook en algo plano. Lanza ZodError si la forma no es la de Meta.
 * Ignora campos distintos de `messages` (p. ej. `account_update`, `message_template_status_update`).
 */
export function parseWebhook(json: unknown): ParsedWebhook {
  const payload = webhookPayloadSchema.parse(json);
  const statuses: StatusUpdate[] = [];
  const inbound: InboundMessage[] = [];

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const v = change.value;
      const phoneNumberId = v.metadata?.phone_number_id ?? null;
      const names = new Map<string, string>();
      for (const c of v.contacts ?? []) if (c.profile?.name) names.set(c.wa_id, c.profile.name);

      for (const s of v.statuses ?? []) {
        if (s.status === "deleted" || s.status === "warning") continue;
        const err = s.errors?.[0];
        statuses.push({
          waMessageId: s.id,
          status: s.status,
          recipient: fromWaId(s.recipient_id),
          recipientRaw: s.recipient_id,
          timestamp: tsToDate(s.timestamp),
          errorCode: err ? String(err.code) : null,
          errorTitle: err?.title ?? err?.message ?? null,
          raw: s,
        });
      }

      for (const m of v.messages ?? []) {
        const buttonPayload = m.button?.payload ?? m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? null;
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? null;
        inbound.push({
          waMessageId: m.id,
          from: fromWaId(m.from),
          fromRaw: m.from,
          profileName: names.get(m.from) ?? null,
          timestamp: tsToDate(m.timestamp),
          type: m.type,
          text,
          buttonPayload,
          contextMessageId: m.context?.id ?? null,
          intent: detectIntent(buttonPayload, text),
          phoneNumberId,
          raw: m,
        });
      }
    }
  }
  return { statuses, inbound };
}

function tsToDate(ts: string): Date {
  const n = Number(ts);
  return Number.isFinite(n) ? new Date(n * 1000) : new Date();
}
