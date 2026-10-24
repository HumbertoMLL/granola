import { functions } from "@granola/jobs";
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest-client";

// Endpoint que Inngest llama para ejecutar pasos. `inngest` es el mismo cliente con el
// que se crearon `functions` (re-exportado desde @granola/jobs).
// En dev: `npx inngest-cli@latest dev -u http://localhost:3100/api/inngest`.
// En prod: INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
