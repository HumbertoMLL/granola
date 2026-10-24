/**
 * Normalización de teléfonos mexicanos a E.164 (+52 + 10 dígitos).
 *
 * Acepta lo que la gente escribe: "33 1234 5678", "(55) 1234-5678", "+52 1 33 1234 5678",
 * "044 33 1234 5678", "01 33 …", "52133…", "5533…". Quita el "1" viejo de celular
 * (+52 1 …) que WhatsApp ya no usa y los prefijos nacionales 01/044/045.
 *
 * Devuelve null si no se puede interpretar como un número MX de 10 dígitos.
 */
export function normalizePhoneMx(input: string | null | undefined): string | null {
  if (!input) return null;
  const hasPlus = input.trim().startsWith("+");
  let digits = input.replace(/\D/g, "");
  if (!digits) return null;
  // Con "+" explícito y lada país distinta de 52 es un número extranjero.
  if (hasPlus && !digits.startsWith("52")) return null;

  // Prefijo internacional "00" (p. ej. 0052…).
  if (digits.startsWith("00") && digits.length > 12) digits = digits.slice(2);

  let national: string | null = null;

  if (digits.startsWith("52") && digits.length >= 12) {
    let rest = digits.slice(2);
    // "+52 1 33 …": el 1 de celular viejo.
    if (rest.length === 11 && rest.startsWith("1")) rest = rest.slice(1);
    national = rest;
  } else if ((digits.startsWith("044") || digits.startsWith("045")) && digits.length === 13) {
    national = digits.slice(3);
  } else if (digits.startsWith("01") && digits.length === 12) {
    national = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("1")) {
    // "1 33 1234 5678" sin lada país.
    national = digits.slice(1);
  } else {
    national = digits;
  }

  if (national.length !== 10) return null;
  // Las ladas mexicanas empiezan en 2–9.
  if (!/^[2-9]\d{9}$/.test(national)) return null;
  return `+52${national}`;
}

/** Meta espera el número sin "+": "5233…". */
export function toWaId(e164: string): string {
  return e164.replace(/^\+/, "");
}

/** Inverso: lo que llega en `from` / `wa_id` ("52133…" o "5233…") → E.164. */
export function fromWaId(waId: string): string | null {
  return normalizePhoneMx(`+${waId.replace(/^\+/, "")}`);
}
