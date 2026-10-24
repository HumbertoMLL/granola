import { toNextJsHandler } from "@granola/auth/next";
import { auth } from "@/lib/auth";

// Se pasa un objeto con `handler` para que la instancia de Better Auth se cree
// en la primera petición y no al compilar (sin DATABASE_URL el build pasa).
export const { GET, POST } = toNextJsHandler({
  handler: (request) => auth.handler(request),
});
