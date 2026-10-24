import { EventSchemas, Inngest } from "inngest";
import { events } from "./events";

/**
 * Cliente único de Inngest. Las funciones de `src/functions/*` se crean con él;
 * apps/web/src/lib/inngest-client.ts debe re-exportarlo (o al menos usar el
 * mismo id y los mismos schemas) para que `inngest.send()` quede tipado igual.
 *
 * `fromSchema` acepta el record `{ "appointment/confirmed": zodSchema }` vía
 * Standard Schema (Zod 4). `fromZod` solo entiende Zod 3 y exige `{ data }`.
 */
export const inngest = new Inngest({
  id: "granola",
  schemas: new EventSchemas().fromSchema(events),
});

export type InngestClient = typeof inngest;
