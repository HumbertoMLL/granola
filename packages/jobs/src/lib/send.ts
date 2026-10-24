import { db } from "@granola/db";
import {
  createWhatsAppClient,
  sendTemplateAndRecord,
  type SendAndRecordResult,
  type TemplateMessage,
  WhatsAppApiError,
} from "@granola/whatsapp";
import { NonRetriableError } from "inngest";
import type { AppointmentContext } from "./appointment";

let _client: ReturnType<typeof createWhatsAppClient> | undefined;
function client() {
  return (_client ??= createWhatsAppClient());
}

export type SendOutcome = { sent: true; messageRowId: string; dryRun: boolean } | { sent: false; reason: string };

/**
 * Envía al paciente registrando en wa_messages. Errores no reintentables de
 * Meta (número inválido, plantilla no aprobada…) se convierten en
 * NonRetriableError para no quemar reintentos; los 5xx/429 sí reintentan.
 */
export async function sendToPatient(ctx: AppointmentContext, template: TemplateMessage): Promise<SendOutcome> {
  if (!ctx.patient.phoneWa) return { sent: false, reason: "paciente sin phone_wa" };
  return send(ctx.patient.phoneWa, ctx.appointment.nutritionistId, ctx.patient.id, template);
}

export async function sendToNutritionist(ctx: AppointmentContext, template: TemplateMessage): Promise<SendOutcome> {
  if (!ctx.nutritionist.phoneWa) return { sent: false, reason: "nutri sin phone_wa" };
  return send(ctx.nutritionist.phoneWa, ctx.appointment.nutritionistId, null, template);
}

async function send(to: string, nutritionistId: string, patientId: string | null, template: TemplateMessage): Promise<SendOutcome> {
  let r: SendAndRecordResult;
  try {
    r = await sendTemplateAndRecord({ db, client: client(), nutritionistId, patientId, to, template });
  } catch (err) {
    if (err instanceof WhatsAppApiError && !err.retriable) {
      throw new NonRetriableError(`WhatsApp rechazó ${template.name}: ${err.message}`, { cause: err });
    }
    throw err;
  }
  return { sent: true, messageRowId: r.messageRowId, dryRun: r.result.dryRun };
}
