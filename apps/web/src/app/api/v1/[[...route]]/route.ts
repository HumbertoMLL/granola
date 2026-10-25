// API v1 (Hono) montada dentro de Next: mismo deploy, mismo dominio. La app vive
// en packages/api (sin dependencia de Next). Ver docs/adr/0007-hono-api-v1.md.
//
// No choca con las otras rutas de /api: Next resuelve primero los segmentos
// estáticos (/api/auth, /api/webhooks/*, /api/inngest, /api/connect/*) y este
// catch-all solo cubre /api/v1 y /api/v1/*.
//
// Sin `export const runtime`: con cacheComponents no se permite y el default
// (Node.js) es el que queremos (driver neon-http + Better Auth).
import { app } from "@granola/api";
import { handle } from "@hono/vercel";

const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
