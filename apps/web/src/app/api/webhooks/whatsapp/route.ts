import {
  applyStatusUpdates,
  createWhatsAppClient,
  parseWebhook,
  readWhatsAppEnv,
  recordInbound,
  resolveInboundContext,
  sendTextAndRecord,
  verifySignature,
  verifyWebhookChallenge,
  type InboundMessage,
} from "@granola/whatsapp";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";


/**
 * GET: verificación del webhook en Meta (hub.verify_token = WA_VERIFY_TOKEN).
 * Responde el challenge en texto plano.
 */
export async function GET(req: NextRequest) {
  const { verifyToken } = readWhatsAppEnv();
  const challenge = verifyWebhookChallenge(req.nextUrl.searchParams, verifyToken);
  if (!challenge) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
}

/**
 * POST: statuses (sent/delivered/read/failed) e inbound. Valida X-Hub-Signature-256
 * contra el body crudo. Siempre responde 200 rápido cuando la firma es válida;
 * si respondemos ≠200 Meta reintenta durante días y acaba desactivando el webhook.
 */
export async function POST(req: NextRequest) {
  const { appSecret } = readWhatsAppEnv();
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let parsed: ReturnType<typeof parseWebhook>;
  try {
    parsed = parseWebhook(JSON.parse(raw));
  } catch (err) {
    console.warn("[wa-webhook] payload no reconocido", err);
    return NextResponse.json({ ok: true, ignored: true });
  }

  try {
    const statuses = await applyStatusUpdates(db, parsed.statuses);
    const inbound = [];
    for (const msg of parsed.inbound) inbound.push(await handleInbound(msg));
    return NextResponse.json({ ok: true, statuses: statuses.length, inbound });
  } catch (err) {
    // Se loguea pero se responde 200: el reintento de Meta no arregla un error nuestro
    // y duplicaría los efectos. wa_message_id único protege de repetidos.
    console.error("[wa-webhook] error procesando", err);
    return NextResponse.json({ ok: true, error: "processing_failed" });
  }
}

async function handleInbound(msg: InboundMessage) {
  const ctx = await resolveInboundContext(db, msg);
  if (!ctx) {
    console.info(`[wa-webhook] inbound de ${msg.fromRaw} sin paciente asociado; se ignora`);
    return { waMessageId: msg.waMessageId, handled: false, reason: "unknown_sender" };
  }

  // Regla dura #3: primero se guarda (wa_message_id único); si ya existía, no se vuelve a actuar.
  const rowId = await recordInbound(db, msg, ctx);
  if (!rowId) return { waMessageId: msg.waMessageId, handled: false, reason: "duplicate" };

  const client = createWhatsAppClient();
  await client.markRead(msg.waMessageId).catch(() => undefined);

  // El mensaje del paciente abre la ventana de 24h: aquí sí podemos responder con texto libre.
  if (msg.intent?.kind === "confirm" && msg.from) {
    await sendTextAndRecord({
      db,
      client,
      nutritionistId: ctx.nutritionistId,
      patientId: ctx.patientId,
      to: msg.from,
      body: "¡Gracias por confirmar! Te esperamos. Si necesitas mover la cita, usa el link que te mandamos.",
    }).catch((err: unknown) => console.warn("[wa-webhook] no se pudo responder al Confirmo", err));
  }
  // intent "reschedule": el paciente ya tiene el botón URL → /cita/{token}. No hay acción server-side en F1.

  return { waMessageId: msg.waMessageId, handled: true, intent: msg.intent?.kind ?? null, appointmentId: ctx.appointmentId };
}
