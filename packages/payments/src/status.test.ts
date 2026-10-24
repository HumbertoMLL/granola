import { describe, expect, it } from "vitest";

import { mapMercadoPagoStatus, mapStripeEvent, shouldApplyTransition } from "./status";

describe("mapStripeEvent", () => {
  it("checkout.session.completed con payment_status paid → paid", () => {
    expect(mapStripeEvent("checkout.session.completed", "paid")).toBe("paid");
    expect(mapStripeEvent("checkout.session.completed", "no_payment_required")).toBe("paid");
  });

  it("completed con unpaid (método asíncrono) no cambia nada", () => {
    expect(mapStripeEvent("checkout.session.completed", "unpaid")).toBeNull();
  });

  it("async_payment_succeeded → paid, async_payment_failed → failed", () => {
    expect(mapStripeEvent("checkout.session.async_payment_succeeded", "paid")).toBe("paid");
    expect(mapStripeEvent("checkout.session.async_payment_failed", "unpaid")).toBe("failed");
  });

  it("expired → expired", () => {
    expect(mapStripeEvent("checkout.session.expired", "unpaid")).toBe("expired");
  });

  it("eventos desconocidos se ignoran", () => {
    expect(mapStripeEvent("payment_intent.created", null)).toBeNull();
    expect(mapStripeEvent("charge.refunded", undefined)).toBeNull();
  });
});

describe("mapMercadoPagoStatus", () => {
  it.each([
    ["approved", undefined, "paid"],
    ["rejected", "cc_rejected_high_risk", "failed"],
    ["cancelled", undefined, "failed"],
    ["cancelled", "expired", "expired"],
    ["refunded", undefined, "refunded"],
    ["charged_back", undefined, "refunded"],
  ] as const)("%s/%s → %s", (status, detail, expected) => {
    expect(mapMercadoPagoStatus(status, detail)).toBe(expected);
  });

  it.each(["pending", "in_process", "authorized", "in_mediation", "algo_nuevo", null, undefined])(
    "%s no transiciona",
    (status) => {
      expect(mapMercadoPagoStatus(status)).toBeNull();
    },
  );
});

describe("shouldApplyTransition (idempotencia)", () => {
  it("pending → paid se aplica una sola vez", () => {
    expect(shouldApplyTransition("pending", "paid")).toBe(true);
    expect(shouldApplyTransition("paid", "paid")).toBe(false);
  });

  it("un pago paid nunca retrocede a failed/expired/pending", () => {
    expect(shouldApplyTransition("paid", "failed")).toBe(false);
    expect(shouldApplyTransition("paid", "expired")).toBe(false);
    expect(shouldApplyTransition("paid", "pending")).toBe(false);
  });

  it("paid → refunded sí; refunded es terminal", () => {
    expect(shouldApplyTransition("paid", "refunded")).toBe(true);
    expect(shouldApplyTransition("refunded", "paid")).toBe(false);
    expect(shouldApplyTransition("refunded", "failed")).toBe(false);
  });

  it("failed/expired → paid se acepta (MP reintentó y aprobó)", () => {
    expect(shouldApplyTransition("failed", "paid")).toBe(true);
    expect(shouldApplyTransition("expired", "paid")).toBe(true);
  });

  it("null nunca se aplica", () => {
    expect(shouldApplyTransition("pending", null)).toBe(false);
  });
});
