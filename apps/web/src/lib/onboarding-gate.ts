import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

/** Header que `proxy.ts` agrega al request con el pathname (los layouts no lo reciben). */
export const PATHNAME_HEADER = "x-granola-pathname";
export const ONBOARDING_PATH = "/app/onboarding";
/** `onboarding_step` = pasos completados; 4 = wizard terminado u omitido. */
export const ONBOARDING_DONE_STEP = 4;

/**
 * Gate server-side del wizard. Lo llama el layout del panel en cada render:
 * con `onboarding_step < 4` cualquier ruta que no sea /app/onboarding redirige
 * ahí. Devuelve true si el request es la ruta del wizard (el layout la pinta sin
 * navegación, para que no haya enlaces que esquiven el gate en navegación cliente).
 */
export async function enforceOnboarding(step: number): Promise<{ onOnboardingRoute: boolean }> {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "";
  const onOnboardingRoute = pathname === ONBOARDING_PATH || pathname.startsWith(`${ONBOARDING_PATH}/`);
  if (step < ONBOARDING_DONE_STEP && !onOnboardingRoute) redirect(ONBOARDING_PATH);
  return { onOnboardingRoute };
}
