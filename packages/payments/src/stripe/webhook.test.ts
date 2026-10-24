import { beforeAll, describe, expect, it } from "vitest";

// Keys de prueba: getStripe() las lee perezosamente, por eso se setean antes del import dinámico.
const WEBHOOK_SECRET = "whsec_test_granola_fixture";

beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_granola_fixture";
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

const sessionCompletedPayload = JSON.stringify({
  id: "evt_test_1",
  object: "event",
  api_version: "2025-09-30.clover",
  created: 1_704_908_010,
  type: "checkout.session.completed",
  livemode: false,
  pending_webhooks: 1,
  request: { id: null, idempotency_key: null },
  data: {
    object: {
      id: "cs_test_a1b2c3",
      object: "checkout.session",
      mode: "payment",
      payment_status: "paid",
      status: "complete",
      amount_total: 80000,
      currency: "mxn",
      metadata: {
        appointmentId: "0f0e0d0c-0b0a-4908-8706-050403020100",
        paymentId: "11111111-2222-4333-8444-555555555555",
        nutritionistId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      },
    },
  },
});

describe("constructStripeEvent (verificación de firma)", () => {
  it("acepta un payload firmado con el secret correcto", async () => {
    const { constructStripeEvent, getStripe } = await import("./index");
    const header = getStripe().webhooks.generateTestHeaderString({
      payload: sessionCompletedPayload,
      secret: WEBHOOK_SECRET,
    });
    const event = await constructStripeEvent(sessionCompletedPayload, header);
    expect(event.type).toBe("checkout.session.completed");
    expect(event.id).toBe("evt_test_1");
  });

  it("rechaza si falta el header", async () => {
    const { constructStripeEvent } = await import("./index");
    await expect(constructStripeEvent(sessionCompletedPayload, null)).rejects.toThrow(/Stripe-Signature/);
  });

  it("rechaza una firma hecha con otro secret", async () => {
    const { constructStripeEvent, getStripe } = await import("./index");
    const header = getStripe().webhooks.generateTestHeaderString({
      payload: sessionCompletedPayload,
      secret: "whsec_otro",
    });
    await expect(constructStripeEvent(sessionCompletedPayload, header)).rejects.toThrow(/inválida/);
  });

  it("rechaza si el body cambió después de firmar (tampering)", async () => {
    const { constructStripeEvent, getStripe } = await import("./index");
    const header = getStripe().webhooks.generateTestHeaderString({
      payload: sessionCompletedPayload,
      secret: WEBHOOK_SECRET,
    });
    const tampered = sessionCompletedPayload.replace('"amount_total":80000', '"amount_total":1');
    await expect(constructStripeEvent(tampered, header)).rejects.toThrow(/inválida/);
  });

  it("rechaza timestamps viejos (replay)", async () => {
    const { constructStripeEvent, getStripe } = await import("./index");
    const header = getStripe().webhooks.generateTestHeaderString({
      payload: sessionCompletedPayload,
      secret: WEBHOOK_SECRET,
      timestamp: Math.floor(Date.now() / 1000) - 60 * 60, // 1 h atrás; tolerancia default 5 min
    });
    await expect(constructStripeEvent(sessionCompletedPayload, header)).rejects.toThrow(/inválida/);
  });
});

describe("PaymentsNotConfiguredError", () => {
  it("getStripe lanza error claro sin STRIPE_SECRET_KEY", async () => {
    // Módulo fresco sin cache del cliente.
    const saved = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      const { getStripe } = await import("./client?fresh=" + Date.now());
      expect(() => getStripe()).toThrow(/STRIPE_SECRET_KEY/);
    } finally {
      process.env.STRIPE_SECRET_KEY = saved;
    }
  });
});
