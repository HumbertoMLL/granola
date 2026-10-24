// Único punto de entrada a la DB desde apps/web. Solo se importa en código de
// servidor (server components, route handlers, server actions). Nunca en cliente.
export * from "@granola/db";
