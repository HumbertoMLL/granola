import { and, appointments, type Database, desc, eq, inArray, patients, waMessages } from "@granola/db";
import type { InboundMessage, StatusUpdate, WaDeliveryStatus } from "./webhook";

/**
 * Estados que un status nuevo puede sobrescribir. Evita regresar read → delivered
 * cuando Meta entrega los webhooks fuera de orden; idempotente por construcción.
 */
const OVERWRITES: Record<WaDeliveryStatus, ("queued" | "sent" | "delivered" | "read" | "failed")[]> = {
  sent: ["queued"],
  delivered: ["queued", "sent"],
  read: ["queued", "sent", "delivered"],
  failed: ["queued", "sent", "delivered", "read"],
};

export type ApplyStatusResult = { waMessageId: string; status: WaDeliveryStatus; updated: boolean };

/** Actualiza wa_messages por waMessageId. Mensajes desconocidos se ignoran (updated: false). */
export async function applyStatusUpdates(db: Database, statuses: StatusUpdate[]): Promise<ApplyStatusResult[]> {
  const out: ApplyStatusResult[] = [];
  for (const s of statuses) {
    const rows = await db
      .update(waMessages)
      .set({
        status: s.status,
        errorCode: s.status === "failed" ? (s.errorCode ?? "unknown") : undefined,
        updatedAt: new Date(),
      })
      .where(and(eq(waMessages.waMessageId, s.waMessageId), inArray(waMessages.status, OVERWRITES[s.status])))
      .returning({ id: waMessages.id });
    out.push({ waMessageId: s.waMessageId, status: s.status, updated: rows.length > 0 });
  }
  return out;
}

export type InboundContext = { nutritionistId: string; patientId: string | null; appointmentId: string | null };

/**
 * Con número compartido de Granola, hay que deducir a qué nutri pertenece el
 * mensaje: 1) por el appointmentId del payload del botón; 2) por el teléfono
 * del paciente (el más reciente). Null si no se reconoce al remitente.
 */
export async function resolveInboundContext(db: Database, msg: InboundMessage): Promise<InboundContext | null> {
  if (msg.intent?.appointmentId) {
    const appt = await db.query.appointments.findFirst({
      where: eq(appointments.id, msg.intent.appointmentId),
      columns: { id: true, nutritionistId: true, patientId: true },
    });
    if (appt) return { nutritionistId: appt.nutritionistId, patientId: appt.patientId, appointmentId: appt.id };
  }
  const candidates = [msg.from, `+${msg.fromRaw}`, msg.fromRaw].filter((x): x is string => !!x);
  const patient = await db.query.patients.findFirst({
    where: inArray(patients.phoneWa, candidates),
    orderBy: [desc(patients.updatedAt)],
    columns: { id: true, nutritionistId: true },
  });
  if (!patient) return null;
  return { nutritionistId: patient.nutritionistId, patientId: patient.id, appointmentId: null };
}

/**
 * Registra el mensaje entrante. Idempotente por `wa_message_id` único: si ya
 * existe devuelve null (webhook repetido) y la ruta no debe volver a actuar.
 */
export async function recordInbound(db: Database, msg: InboundMessage, ctx: InboundContext): Promise<string | null> {
  const rows = await db
    .insert(waMessages)
    .values({
      nutritionistId: ctx.nutritionistId,
      patientId: ctx.patientId,
      direction: "inbound",
      template: null,
      waMessageId: msg.waMessageId,
      status: "delivered",
      payload: {
        from: msg.from ?? msg.fromRaw,
        type: msg.type,
        text: msg.text,
        buttonPayload: msg.buttonPayload,
        contextMessageId: msg.contextMessageId,
        intent: msg.intent,
        appointmentId: ctx.appointmentId,
        raw: msg.raw,
      },
    })
    .onConflictDoNothing({ target: waMessages.waMessageId })
    .returning({ id: waMessages.id });
  return rows[0]?.id ?? null;
}
