/** Zonas horarias de LATAM (+ España y EE. UU.) para el selector de disponibilidad. */
export const LATAM_TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Mexico_City", label: "Ciudad de México (centro)" },
  { value: "America/Cancun", label: "Cancún (sureste, UTC-5)" },
  { value: "America/Chihuahua", label: "Chihuahua" },
  { value: "America/Ciudad_Juarez", label: "Ciudad Juárez" },
  { value: "America/Hermosillo", label: "Hermosillo (Sonora)" },
  { value: "America/Mazatlan", label: "Mazatlán (pacífico)" },
  { value: "America/Tijuana", label: "Tijuana (Baja California)" },
  { value: "America/Guatemala", label: "Guatemala" },
  { value: "America/El_Salvador", label: "El Salvador" },
  { value: "America/Tegucigalpa", label: "Honduras" },
  { value: "America/Managua", label: "Nicaragua" },
  { value: "America/Costa_Rica", label: "Costa Rica" },
  { value: "America/Panama", label: "Panamá" },
  { value: "America/Bogota", label: "Colombia (Bogotá)" },
  { value: "America/Caracas", label: "Venezuela (Caracas)" },
  { value: "America/Guayaquil", label: "Ecuador (Quito)" },
  { value: "America/Lima", label: "Perú (Lima)" },
  { value: "America/La_Paz", label: "Bolivia (La Paz)" },
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Montevideo", label: "Uruguay (Montevideo)" },
  { value: "America/Asuncion", label: "Paraguay (Asunción)" },
  { value: "America/Sao_Paulo", label: "Brasil (São Paulo)" },
  { value: "America/Santo_Domingo", label: "República Dominicana" },
  { value: "America/Havana", label: "Cuba" },
  { value: "America/Puerto_Rico", label: "Puerto Rico" },
  { value: "America/Los_Angeles", label: "EE. UU. Pacífico (Los Ángeles)" },
  { value: "America/Denver", label: "EE. UU. Montaña (Denver)" },
  { value: "America/Chicago", label: "EE. UU. Central (Chicago)" },
  { value: "America/New_York", label: "EE. UU. Este (Nueva York)" },
  { value: "Europe/Madrid", label: "España (Madrid)" },
];

export function timezoneLabel(value: string): string {
  return LATAM_TIMEZONES.find((t) => t.value === value)?.label ?? value;
}

export const WEEKDAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
