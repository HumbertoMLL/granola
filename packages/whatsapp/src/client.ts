import { readWhatsAppEnv } from "./env";
import { normalizePhoneMx, toWaId } from "./phone";
import { type SendResult, type TemplateMessage, WhatsAppApiError } from "./types";

export type WhatsAppClientOptions = {
  phoneNumberId?: string;
  accessToken?: string;
  graphVersion?: string;
  /** Inyectable para tests. */
  fetch?: typeof fetch;
  logger?: Pick<Console, "info" | "warn" | "error">;
};

export type SendTemplateInput = {
  /** Teléfono en cualquier formato MX; se normaliza. */
  to: string;
  template: TemplateMessage;
};

export type SendTextInput = {
  to: string;
  body: string;
  previewUrl?: boolean;
};

export type WhatsAppClient = {
  /** true cuando no hay WA_ACCESS_TOKEN / WA_PHONE_NUMBER_ID: loguea y no llama a Meta. */
  readonly dryRun: boolean;
  /** Envía una plantilla aprobada (única forma de iniciar conversación). */
  sendTemplate(input: SendTemplateInput): Promise<SendResult>;
  /**
   * Envía texto libre. SOLO funciona dentro de la ventana de 24h abierta por un
   * mensaje del paciente (Meta rechaza con 131047 fuera de ella). Úsalo para
   * responder a "Confirmo", no para iniciar.
   */
  sendText(input: SendTextInput): Promise<SendResult>;
  /** Marca un mensaje entrante como leído (palomitas azules). */
  markRead(waMessageId: string): Promise<void>;
};

type GraphErrorBody = {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number; error_data?: unknown; fbtrace_id?: string };
};

type GraphMessagesResponse = {
  messaging_product?: string;
  contacts?: { input: string; wa_id: string }[];
  messages?: { id: string; message_status?: string }[];
};

export function createWhatsAppClient(opts: WhatsAppClientOptions = {}): WhatsAppClient {
  const env = readWhatsAppEnv();
  const phoneNumberId = opts.phoneNumberId ?? env.phoneNumberId;
  const accessToken = opts.accessToken ?? env.accessToken;
  const graphVersion = opts.graphVersion ?? env.graphVersion;
  const doFetch = opts.fetch ?? globalThis.fetch;
  const log = opts.logger ?? console;
  const dryRun = !accessToken || !phoneNumberId;

  const endpoint = `https://graph.facebook.com/${graphVersion}/${phoneNumberId ?? "PHONE_NUMBER_ID"}/messages`;

  async function post(body: Record<string, unknown>): Promise<SendResult> {
    if (dryRun) {
      log.info(`[whatsapp:dry-run] POST ${endpoint}\n${JSON.stringify(body, null, 2)}`);
      return { waMessageId: null, dryRun: true, request: body };
    }
    let res: Response;
    try {
      res = await doFetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new WhatsAppApiError(`Red: ${err instanceof Error ? err.message : String(err)}`, { httpStatus: 0, code: 2 });
    }
    const json = (await res.json().catch(() => ({}))) as GraphErrorBody & GraphMessagesResponse;
    if (!res.ok || json.error) {
      const e = json.error ?? {};
      throw new WhatsAppApiError(e.message ?? `Graph respondió ${res.status}`, {
        httpStatus: res.status,
        code: e.code,
        subcode: e.error_subcode,
        details: e,
      });
    }
    return {
      waMessageId: json.messages?.[0]?.id ?? null,
      dryRun: false,
      request: body,
      response: json as Record<string, unknown>,
    };
  }

  function resolveTo(to: string): string {
    const e164 = normalizePhoneMx(to);
    if (!e164) throw new WhatsAppApiError(`Teléfono inválido: "${to}"`, { httpStatus: 400, code: 131026 });
    return toWaId(e164);
  }

  return {
    dryRun,

    async sendTemplate({ to, template }) {
      return post({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: resolveTo(to),
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language },
          components: template.components,
        },
      });
    },

    async sendText({ to, body, previewUrl = false }) {
      return post({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: resolveTo(to),
        type: "text",
        text: { preview_url: previewUrl, body },
      });
    },

    async markRead(waMessageId) {
      await post({ messaging_product: "whatsapp", status: "read", message_id: waMessageId });
    },
  };
}
