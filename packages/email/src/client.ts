import { z } from "zod";

const tagPart = z.string().min(1).max(256).regex(/^[a-zA-Z0-9_-]+$/);
export const sendEmailSchema = z.object({
  to: z.union([z.email(), z.array(z.email()).min(1).max(50)]),
  subject: z.string().trim().min(1).max(998).regex(/^[^\r\n]+$/),
  html: z.string().min(1),
  text: z.string().min(1),
  tags: z.array(z.object({ name: tagPart, value: tagPart })).optional(),
  /** Resend deduplica durante 24h. Inngest conserva los steps completados después. */
  idempotencyKey: z.string().min(1).max(256).regex(/^[\x21-\x7e]+$/).optional(),
});
export type SendEmailInput = z.infer<typeof sendEmailSchema>;
export type SendEmailResult = { id: string | null; dryRun: boolean };
export type EmailClientOptions = { fetch?: typeof fetch; logger?: Pick<Console, "info" | "error"> };

export class EmailApiError extends Error {
  readonly retriable: boolean;
  constructor(readonly httpStatus: number) {
    super(`No se pudo enviar el correo (Resend HTTP ${httpStatus})`);
    this.name = "EmailApiError";
    this.retriable = httpStatus === 0 || httpStatus === 429 || httpStatus >= 500;
  }
}

function sender(raw: string | undefined): string {
  const value = z.string().trim().min(1, "EMAIL_FROM es obligatorio al configurar Resend").regex(/^[^\r\n]+$/).parse(raw);
  const address = value.match(/^[^<>]+<([^<>]+)>$/)?.[1] ?? value;
  z.email().parse(address.trim());
  return value;
}

/** Sin SDK, Next ni persistencia. La configuración se lee al enviar, nunca al importar. */
export function createEmailClient(options: EmailClientOptions = {}) {
  const doFetch = options.fetch ?? globalThis.fetch;
  const logger = options.logger ?? console;
  return {
    async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
      const data = sendEmailSchema.parse(input);
      const apiKey = process.env.RESEND_API_KEY?.trim();
      const recipientCount = Array.isArray(data.to) ? data.to.length : 1;
      // No loguear destinatarios, asuntos, contenido, URLs con tokens ni API keys.
      if (!apiKey) {
        logger.info("[email:dry-run]", { recipientCount });
        return { id: null, dryRun: true };
      }
      const from = sender(process.env.EMAIL_FROM);
      const { idempotencyKey, ...message } = data;
      let response: Response;
      try {
        response = await doFetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
          },
          body: JSON.stringify({ from, ...message }),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        logger.error("[email:failed]", { httpStatus: 0 });
        throw new EmailApiError(0);
      }
      if (!response.ok) {
        logger.error("[email:failed]", { httpStatus: response.status });
        throw new EmailApiError(response.status);
      }
      const parsed = z.object({ id: z.string().min(1) }).safeParse(await response.json().catch(() => null));
      if (!parsed.success) {
        logger.error("[email:failed]", { httpStatus: 502 });
        throw new EmailApiError(502);
      }
      logger.info("[email:sent]", { id: parsed.data.id, recipientCount });
      return { id: parsed.data.id, dryRun: false };
    },
  };
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  return createEmailClient().sendEmail(input);
}
