import { EventSchemas, Inngest } from "inngest";
import { events } from "@granola/jobs/events";

/**
 * Cliente Inngest compartido por apps/web. Los eventos y sus payloads salen del
 * contrato en `@granola/jobs/events` (zod), así `inngest.send()` queda tipado.
 *
 * `fromSchema` acepta directamente el record `{ "appointment/confirmed": zodSchema }`
 * (Standard Schema; `fromZod` está deprecado y exigiría envolver cada uno en `{ data }`).
 *
 * Sin INNGEST_EVENT_KEY en dev, el SDK manda los eventos al dev server local
 * (`npx inngest-cli dev`) o los descarta con un warning; nunca rompe el request.
 */
export const inngest = new Inngest({
  id: "granola",
  schemas: new EventSchemas().fromSchema(events),
});

export type GranolaInngest = typeof inngest;

type SendPayload = Parameters<GranolaInngest["send"]>[0];

/**
 * `inngest.send` que nunca tira el request del usuario: si no hay dev server
 * ni INNGEST_EVENT_KEY (local sin infra) solo deja un warning. La cita ya quedó
 * guardada; el WhatsApp se puede reintentar desde el panel.
 */
export async function sendEvent(payload: SendPayload): Promise<boolean> {
  try {
    await inngest.send(payload);
    return true;
  } catch (err) {
    console.warn("[inngest] no se pudo enviar el evento:", err instanceof Error ? err.message : err);
    return false;
  }
}
