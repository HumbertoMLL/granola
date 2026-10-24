/**
 * Normalización de WhatsApp a E.164. Puro (lo usan el formulario y la server action).
 * Lada por defecto +52 (México). Para números mexicanos acepta el "1" de celular
 * viejo (+52 1 55…) y lo elimina, como exige la Cloud API de WhatsApp.
 */

export const DEFAULT_DIAL_CODE = "52";

/** Ladas LATAM + USA para el selector del formulario. */
export const DIAL_CODES: { code: string; country: string; flag: string }[] = [
  { code: "52", country: "México", flag: "🇲🇽" },
  { code: "1", country: "EE. UU. / Canadá", flag: "🇺🇸" },
  { code: "54", country: "Argentina", flag: "🇦🇷" },
  { code: "591", country: "Bolivia", flag: "🇧🇴" },
  { code: "55", country: "Brasil", flag: "🇧🇷" },
  { code: "56", country: "Chile", flag: "🇨🇱" },
  { code: "57", country: "Colombia", flag: "🇨🇴" },
  { code: "506", country: "Costa Rica", flag: "🇨🇷" },
  { code: "593", country: "Ecuador", flag: "🇪🇨" },
  { code: "503", country: "El Salvador", flag: "🇸🇻" },
  { code: "34", country: "España", flag: "🇪🇸" },
  { code: "502", country: "Guatemala", flag: "🇬🇹" },
  { code: "504", country: "Honduras", flag: "🇭🇳" },
  { code: "505", country: "Nicaragua", flag: "🇳🇮" },
  { code: "507", country: "Panamá", flag: "🇵🇦" },
  { code: "595", country: "Paraguay", flag: "🇵🇾" },
  { code: "51", country: "Perú", flag: "🇵🇪" },
  { code: "1809", country: "Rep. Dominicana", flag: "🇩🇴" },
  { code: "598", country: "Uruguay", flag: "🇺🇾" },
  { code: "58", country: "Venezuela", flag: "🇻🇪" },
];

export type NormalizedPhone = { ok: true; e164: string } | { ok: false; error: string };

/**
 * `national` es lo que teclea el paciente (puede traer espacios, guiones, paréntesis
 * o incluso un "+52" pegado). Devuelve "+52XXXXXXXXXX".
 */
export function normalizePhoneE164(national: string, dialCode: string = DEFAULT_DIAL_CODE): NormalizedPhone {
  const code = dialCode.replace(/\D/g, "");
  let digits = national.replace(/\D/g, "");
  if (!digits) return { ok: false, error: "Escribe tu número de WhatsApp" };

  // Si ya trae la lada (ej. "+52 55 1234 5678" o "52 55…"), la quitamos para no duplicarla.
  if (national.trim().startsWith("+") && digits.startsWith(code)) {
    digits = digits.slice(code.length);
  } else if (code === "52" && digits.length === 12 && digits.startsWith("52")) {
    digits = digits.slice(2);
  } else if (code === "52" && digits.length === 13 && digits.startsWith("521")) {
    digits = digits.slice(3);
  }

  // México: quitar el "1" de celular antiguo (1 + 10 dígitos).
  if (code === "52" && digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  // Rep. Dominicana se marca como +1 809/829/849.
  if (code === "1809") {
    const full = `1${digits.length === 10 ? digits : `809${digits}`}`;
    if (full.length !== 11) return { ok: false, error: "Número inválido" };
    return { ok: true, e164: `+${full}` };
  }

  if (code === "52" && digits.length !== 10) {
    return { ok: false, error: "Un WhatsApp de México tiene 10 dígitos" };
  }
  if (digits.length < 7 || digits.length > 12) {
    return { ok: false, error: "Número inválido" };
  }
  const e164 = `+${code}${digits}`;
  if (e164.length > 16) return { ok: false, error: "Número inválido" };
  return { ok: true, e164 };
}

/** "+525512345678" → "+52 55 1234 5678" (solo visual). */
export function formatPhoneForDisplay(e164: string): string {
  if (e164.startsWith("+52") && e164.length === 13) {
    const n = e164.slice(3);
    return `+52 ${n.slice(0, 2)} ${n.slice(2, 6)} ${n.slice(6)}`;
  }
  return e164;
}
