import { NextResponse, type NextRequest } from "next/server";

import {
  assertMpSignature,
  handleMercadoPagoNotification,
  mpNotificationSchema,
  PaymentsNotConfiguredError,
  WebhookSignatureError,
} from "@granola/payments";

import { sendEvent } from "@/lib/inngest-client";

/**
 * Webhook de Mercado Pago. Configurar en "Tus integraciones → Webhooks":
 *   URL:    https://<dominio>/api/webhooks/mercadopago
 *   Evento: Pagos (payment)
 *   Secret: copiarlo a MP_WEBHOOK_SECRET
 *
 * MP manda `?data.id=<paymentId>&type=payment` en la query y el mismo id en el
 * body; la firma `x-signature` se calcula con el `data.id` de la QUERY.
 * El estado NO viene en la notificación: se consulta GET /v1/payments/{id}.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const queryDataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

  const rawBody = await req.text();
  const parsed = mpNotificationSchema.safeParse(rawBody ? JSON.parse(rawBody) : {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const body = parsed.data;

  const dataIdForSignature = queryDataId ?? (body.data?.id !== undefined ? String(body.data.id) : null);
  try {
    assertMpSignature({
      xSignature: req.headers.get("x-signature"),
      xRequestId: req.headers.get("x-request-id"),
      dataId: dataIdForSignature,
    });
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof PaymentsNotConfiguredError) {
      console.error("[webhooks/mercadopago]", err.message);
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    throw err;
  }

  let eventSent: boolean | null = null;
  const outcome = await handleMercadoPagoNotification(body, queryDataId, {
    onAppointmentConfirmed: async (data) => {
      eventSent = await sendEvent({ name: "appointment/confirmed", data });
      if (!eventSent) console.error("[webhooks/mercadopago] appointment/confirmed no se pudo emitir", data);
    },
  });

  return NextResponse.json({ received: true, outcome, eventSent });
}

/** MP hace un GET al dar de alta la URL para validar que responde. */
export function GET() {
  return NextResponse.json({ ok: true });
}
