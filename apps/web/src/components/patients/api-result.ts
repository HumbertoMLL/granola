/** Errores de transporte sin exponer respuestas del servidor ni dejar promesas sin manejar. */
export async function apiResult<T>(promise: Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await promise;
  } catch {
    return { ok: false, error: "No se pudo conectar. Revisa tu conexión e intenta de nuevo." };
  }
}
