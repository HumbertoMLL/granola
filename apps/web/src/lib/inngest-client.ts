import { inngest, type InngestClient } from "@granola/jobs";

/**
 * Un solo cliente Inngest en todo el monorepo: el de `@granola/jobs`, con el que
 * se crean las funciones. `api/inngest/route.ts` lo sirve y apps/web lo usa
 * para `send()`, así eventos y schemas (zod) quedan tipados igual en ambos lados.
 *
 * Sin INNGEST_EVENT_KEY en dev, el SDK manda los eventos al dev server local
 * (`npx inngest-cli dev`) o falla; `sendEvent` absorbe ese fallo.
 */
export { inngest };

export type GranolaInngest = InngestClient;

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
