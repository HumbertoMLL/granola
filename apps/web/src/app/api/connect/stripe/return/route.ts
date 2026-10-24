import { redirect } from "next/navigation";

/**
 * `return_url` del onboarding de Stripe Connect. Que el usuario vuelva aquí NO
 * garantiza que terminó: el estado real se lee en /app/cobros con
 * `getAccountStatus` (y llega por webhook `account.updated`).
 */
export function GET() {
  redirect("/app/cobros?stripe=return");
}
