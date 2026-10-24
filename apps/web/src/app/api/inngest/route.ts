import { functions } from "@granola/jobs";
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest-client";

// Endpoint que Inngest llama para ejecutar pasos. En dev: `npx inngest-cli@latest dev`
// y apunta a http://localhost:3000/api/inngest. En prod: INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY.
export const { GET, POST, PUT } = serve({ client: inngest, functions });
