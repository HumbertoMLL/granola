import { type Database, waMessages } from "@granola/db";
import type { WhatsAppClient } from "./client";
import { type SendResult, type TemplateMessage, WhatsAppApiError } from "./types";

export type RecordOutboundInput = {
  nutritionistId: string;
  patientId?: string | null;
  /** Nombre de plantilla, o "text" para mensajes libres. */
  template: string;
  /** Teléfono destino (E.164). Se guarda dentro de payload. */
  to: string;
  result: SendResult;
};

/**
 * Regla dura #4: todo lo que sale por WhatsApp queda en wa_messages.
 * Dry run → status "queued" + errorCode "dry_run"; real → "sent" + waMessageId.
 */
export async function recordOutbound(db: Database, input: RecordOutboundInput): Promise<string> {
  const [row] = await db
    .insert(waMessages)
    .values({
      nutritionistId: input.nutritionistId,
      patientId: input.patientId ?? null,
      direction: "outbound",
      template: input.template,
      waMessageId: input.result.waMessageId,
      status: input.result.dryRun ? "queued" : "sent",
      errorCode: input.result.dryRun ? "dry_run" : null,
      payload: { to: input.to, request: input.result.request, response: input.result.response ?? null },
    })
    .returning({ id: waMessages.id });
  if (!row) throw new Error("No se pudo registrar el mensaje en wa_messages");
  return row.id;
}

export type RecordFailedInput = Omit<RecordOutboundInput, "result"> & { error: WhatsAppApiError; request?: Record<string, unknown> };

/** Registra un intento fallido (Meta rechazó) para que quede rastro en el panel. */
export async function recordFailed(db: Database, input: RecordFailedInput): Promise<string> {
  const [row] = await db
    .insert(waMessages)
    .values({
      nutritionistId: input.nutritionistId,
      patientId: input.patientId ?? null,
      direction: "outbound",
      template: input.template,
      waMessageId: null,
      status: "failed",
      errorCode: input.error.code != null ? String(input.error.code) : `http_${input.error.httpStatus}`,
      payload: { to: input.to, request: input.request ?? null, error: { message: input.error.message, details: input.error.details ?? null } },
    })
    .returning({ id: waMessages.id });
  if (!row) throw new Error("No se pudo registrar el fallo en wa_messages");
  return row.id;
}

export type SendTemplateAndRecordInput = {
  db: Database;
  client: WhatsAppClient;
  nutritionistId: string;
  patientId?: string | null;
  to: string;
  template: TemplateMessage;
};

export type SendAndRecordResult = { messageRowId: string; result: SendResult };

/**
 * Envía la plantilla y la registra. Si Meta rechaza, registra el fallo y
 * relanza el WhatsAppApiError (con `retriable`) para que el job decida.
 */
export async function sendTemplateAndRecord(input: SendTemplateAndRecordInput): Promise<SendAndRecordResult> {
  const { db, client, template, to } = input;
  try {
    const result = await client.sendTemplate({ to, template });
    const messageRowId = await recordOutbound(db, {
      nutritionistId: input.nutritionistId,
      patientId: input.patientId,
      template: template.name,
      to,
      result,
    });
    return { messageRowId, result };
  } catch (err) {
    if (err instanceof WhatsAppApiError) {
      await recordFailed(db, { nutritionistId: input.nutritionistId, patientId: input.patientId, template: template.name, to, error: err });
    }
    throw err;
  }
}

export type SendTextAndRecordInput = Omit<SendTemplateAndRecordInput, "template"> & { body: string };

/** Igual que arriba para texto libre (solo dentro de la ventana de 24h). */
export async function sendTextAndRecord(input: SendTextAndRecordInput): Promise<SendAndRecordResult> {
  const { db, client, body, to } = input;
  try {
    const result = await client.sendText({ to, body });
    const messageRowId = await recordOutbound(db, { nutritionistId: input.nutritionistId, patientId: input.patientId, template: "text", to, result });
    return { messageRowId, result };
  } catch (err) {
    if (err instanceof WhatsAppApiError) {
      await recordFailed(db, { nutritionistId: input.nutritionistId, patientId: input.patientId, template: "text", to, error: err });
    }
    throw err;
  }
}
