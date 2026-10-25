/**
 * Dobles de las APIs de Next que solo existen dentro de un request. Se registran
 * con `vi.mock` en integration-setup.ts para todos los `*.int.test.ts`.
 */

/** Lo que lanza nuestro `redirect()` falso; el test puede leer a dónde iba. */
export class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`NEXT_REDIRECT ${url}`);
    this.name = "RedirectSignal";
  }
}

/** IP que devuelve `headers()` (x-forwarded-for) → `patients.consent_ip`. */
export const TEST_CLIENT_IP = "203.0.113.7";

/** Ejecuta una server action que debe terminar en `redirect()` y devuelve la URL. */
export async function expectRedirect(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (err) {
    if (err instanceof RedirectSignal) return err.url;
    throw err;
  }
  throw new Error("Se esperaba un redirect() y la action regresó normalmente");
}
