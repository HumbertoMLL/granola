import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getStripe } from "@granola/payments";
import { seedAppointment, seedNutritionist, seedService } from "@granola/db/testing";

import { appointments, db, eq, payments } from "@/lib/db";
import { sendEvent } from "@/lib/inngest-client";

import { POST } from "./route";

vi.mock("@/lib/inngest-client", () => ({ sendEvent: vi.fn(async () => true) }));

// Llaves ficticias: el SDK de Stripe solo las usa para firmar/verificar localmente, sin red.
const FAKE_SECRET_KEY = "sk_test_granola_fake_0000000000";
const FAKE_WEBHOOK_SECRET = "whsec_granola_fake_0000000000";

/** Fixture mínimo de `checkout.session.completed` (lo que lee handleStripeEvent). */
function checkoutCompletedEvent(sessionId: string, meta: { appointmentId: string; nutritionistId: string }) {
  return {
    id: `evt_test_${sessionId}`,
    object: "event",
    api_version: "2025-09-30.clover",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        mode: "payment",
        status: "complete",
        payment_status: "paid",
        payment_intent: "pi_test_granola_0001",
        url: null,
        amount_total: 80000,
        currency: "mxn",
        metadata: meta,
      },
    },
  };
}

function signedRequest(payload: string, signature?: string): NextRequest {
  const header =
    signature ?? getStripe().webhooks.generateTestHeaderString({ payload, secret: FAKE_WEBHOOK_SECRET });
  return new NextRequest("http://localhost:3100/api/webhooks/stripe", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json", "stripe-signature": header },
  });
}

describe("Cuando Stripe llama al webhook (/api/webhooks/stripe)", () => {
  let appointmentId: string;
  let nutritionistId: string;
  const sessionId = "cs_test_granola_0001";

  beforeAll(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", FAKE_SECRET_KEY);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", FAKE_WEBHOOK_SECRET);
  });

  beforeEach(async () => {
    const { nutritionist } = await seedNutritionist({ slug: "karla-test", stripeAccountId: "acct_test_granola" });
    nutritionistId = nutritionist.id;
    const service = await seedService({ nutritionistId, paymentMode: "prepaid", priceCents: 80000, durationMin: 60 });
    const appt = await seedAppointment({ nutritionistId, serviceId: service.id, status: "pending_payment" });
    appointmentId = appt.id;
    await db.insert(payments).values({
      appointmentId,
      provider: "stripe",
      method: "card",
      status: "pending",
      amountCents: 80000,
      currency: "MXN",
      providerRef: sessionId,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
  });

  describe("con checkout.session.completed bien firmado", () => {
    it("el pago queda paid, la cita confirmed y se emite appointment/confirmed", async () => {
      const payload = JSON.stringify(checkoutCompletedEvent(sessionId, { appointmentId, nutritionistId }));

      const res = await POST(signedRequest(payload));

      expect(res.status).toBe(200);
      const [pay] = await db.select().from(payments).where(eq(payments.providerRef, sessionId));
      expect(pay).toMatchObject({ status: "paid" });
      expect(pay!.paidAt).toBeInstanceOf(Date);
      expect(pay!.providerData).toMatchObject({ providerId: sessionId, paymentIntentId: "pi_test_granola_0001" });
      const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
      expect(appt!.status).toBe("confirmed");
      expect(sendEvent).toHaveBeenCalledTimes(1);
      expect(sendEvent).toHaveBeenCalledWith({
        name: "appointment/confirmed",
        data: { appointmentId, nutritionistId },
      });
    });

    it("si Stripe reintenta el mismo evento, es idempotente: 200, sin cambios y sin segundo evento", async () => {
      const payload = JSON.stringify(checkoutCompletedEvent(sessionId, { appointmentId, nutritionistId }));

      const first = await POST(signedRequest(payload));
      const [afterFirst] = await db.select().from(payments).where(eq(payments.providerRef, sessionId));
      const second = await POST(signedRequest(payload));

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(await second.json()).toMatchObject({
        outcome: { kind: "payment", applied: false, reason: "already_processed" },
      });
      const rows = await db.select().from(payments).where(eq(payments.appointmentId, appointmentId));
      expect(rows).toHaveLength(1);
      expect(rows[0]!.paidAt?.getTime()).toBe(afterFirst!.paidAt?.getTime());
      expect(sendEvent).toHaveBeenCalledTimes(1);
    });

    it("una cita que ya se canceló no revive aunque llegue el pago", async () => {
      await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, appointmentId));
      const payload = JSON.stringify(checkoutCompletedEvent(sessionId, { appointmentId, nutritionistId }));

      const res = await POST(signedRequest(payload));

      expect(res.status).toBe(200);
      const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
      expect(appt!.status).toBe("cancelled");
      expect(sendEvent).not.toHaveBeenCalled();
    });
  });

  describe("con firma inválida", () => {
    it("responde 400 y no toca pago ni cita", async () => {
      const payload = JSON.stringify(checkoutCompletedEvent(sessionId, { appointmentId, nutritionistId }));
      const forged = getStripe().webhooks.generateTestHeaderString({ payload, secret: "whsec_otra_llave" });

      const res = await POST(signedRequest(payload, forged));

      expect(res.status).toBe(400);
      const [pay] = await db.select().from(payments).where(eq(payments.providerRef, sessionId));
      expect(pay!.status).toBe("pending");
      const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
      expect(appt!.status).toBe("pending_payment");
      expect(sendEvent).not.toHaveBeenCalled();
    });

    it("responde 400 si el cuerpo se alteró después de firmar", async () => {
      const payload = JSON.stringify(checkoutCompletedEvent(sessionId, { appointmentId, nutritionistId }));
      const header = getStripe().webhooks.generateTestHeaderString({ payload, secret: FAKE_WEBHOOK_SECRET });
      const tampered = payload.replace('"amount_total":80000', '"amount_total":1');

      const res = await POST(signedRequest(tampered, header));

      expect(res.status).toBe(400);
      expect(sendEvent).not.toHaveBeenCalled();
    });

    it("responde 400 si falta el header Stripe-Signature", async () => {
      const payload = JSON.stringify(checkoutCompletedEvent(sessionId, { appointmentId, nutritionistId }));
      const req = new NextRequest("http://localhost:3100/api/webhooks/stripe", { method: "POST", body: payload });

      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });
});
