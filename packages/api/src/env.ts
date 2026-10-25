import type { Session, SessionUser } from "@granola/auth";
import type { nutritionists } from "@granola/db";
import type { BlankEnv } from "hono/types";

export type Nutritionist = typeof nutritionists.$inferSelect;

/** Variables que pone `requireSession`. */
export type SessionVariables = {
  user: SessionUser;
  session: Session["session"];
};

/** Variables que pone `requireNutritionist` (además de las de sesión). */
export type TenantVariables = SessionVariables & {
  nutritionist: Nutritionist;
};

/**
 * Env base de la app: vacío a propósito. Cada middleware (`requireSession`,
 * `requireNutritionist`) declara sus variables y Hono las agrega a las rutas
 * que lo usan, así `c.get("nutritionist")` solo tipa donde de verdad existe.
 */
export type AppEnv = BlankEnv;
