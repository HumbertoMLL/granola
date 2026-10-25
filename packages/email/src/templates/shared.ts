import { z } from "zod";

export type EmailTemplate = { subject: string; html: string; text: string };
export const nameSchema = z.string().trim().min(1).max(200).regex(/^[^\r\n]+$/);
export const linkSchema = z.url().refine((url) => ["https:", "http:"].includes(new URL(url).protocol), "Usa un enlace HTTP o HTTPS");
export const appointmentSchema = z.object({
  patientName: nameSchema,
  nutritionistName: nameSchema,
  serviceName: nameSchema,
  startsAt: z.date(),
  timeZone: z.string().refine((zone) => {
    try { new Intl.DateTimeFormat("es-MX", { timeZone: zone }); return true; } catch { return false; }
  }, "Zona horaria inválida"),
  modality: z.enum(["online", "presencial"]),
  meetUrl: linkSchema.nullable(),
  location: z.string().trim().max(1000).nullable(),
  manageUrl: linkSchema,
});
export type AppointmentEmailInput = z.infer<typeof appointmentSchema>;

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function renderEmail(subject: string, paragraphs: string[], action?: { label: string; url: string }): EmailTemplate {
  if (action) linkSchema.parse(action.url);
  const footer = "Granola · Tu consulta, más simple.";
  const text = [subject, ...paragraphs, ...(action ? [`${action.label}: ${action.url}`] : []), footer].join("\n\n");
  const html = `<!doctype html><html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:24px;background:#FBF7F0;color:#2B2118;font-family:Arial,sans-serif;line-height:1.6"><main style="max-width:560px;margin:0 auto;padding:24px;background:#ffffff;border-radius:16px"><p style="color:#4A7A2B;font-size:24px;font-weight:bold;margin-top:0">Granola</p><h1 style="font-size:22px">${escapeHtml(subject)}</h1>${paragraphs.map((p) => `<p style="white-space:pre-line">${escapeHtml(p)}</p>`).join("")}${action ? `<p style="margin:28px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#4A7A2B;color:#ffffff;padding:12px 20px;border-radius:24px;text-decoration:none">${escapeHtml(action.label)}</a></p><p style="font-size:12px;word-break:break-all">${escapeHtml(action.url)}</p>` : ""}<p style="font-size:12px;margin-top:32px">${footer}</p></main></body></html>`;
  return { subject, html, text };
}

export function appointmentDetails(data: AppointmentEmailInput): string[] {
  const when = new Intl.DateTimeFormat("es-MX", { timeZone: data.timeZone, dateStyle: "full", timeStyle: "short" }).format(data.startsAt);
  return [
    `Servicio: ${data.serviceName}`,
    `Fecha: ${when} (${data.timeZone})`,
    `Modalidad: ${data.modality === "online" ? "En línea" : "Presencial"}`,
    ...(data.modality === "presencial" && data.location ? [`Dirección: ${data.location}`] : []),
    ...(data.modality === "online" && data.meetUrl ? [`Videollamada: ${data.meetUrl}`] : []),
  ];
}
