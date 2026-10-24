import { describe, expect, it } from "vitest";

import { PaymentsError, PaymentsNotConfiguredError } from "@granola/payments";

import {
  CARD_PAYMENT_TTL_MS,
  CHECKOUT_FAILED_ERROR,
  decideBookingOutcome,
  initialAppointmentStatus,
  isPaymentsUnavailableError,
  listoPath,
  type BookingOutcomeInput,
} from "./outcome";

const now = new Date("2026-10-24T15:00:00.000Z");
const startsAt = new Date("2026-10-28T16:00:00.000Z");
const base: Omit<BookingOutcomeInput, "paymentMode" | "checkout"> = {
  slug: "karla",
  cancelToken: "tok_abc-123",
  startsAt,
  now,
};

describe("initialAppointmentStatus", () => {
  it("prepagado entra como pending_payment; el resto confirmed", () => {
    expect(initialAppointmentStatus("prepaid")).toBe("pending_payment");
    expect(initialAppointmentStatus("at_visit")).toBe("confirmed");
    expect(initialAppointmentStatus("optional")).toBe("confirmed");
  });
});

describe("listoPath", () => {
  it("codifica el token y agrega ?pago", () => {
    expect(listoPath("karla", "a b")).toBe("/karla/agendar/listo?cita=a%20b");
    expect(listoPath("karla", "t", "ok")).toBe("/karla/agendar/listo?cita=t&pago=ok");
  });
});

describe("decideBookingOutcome", () => {
  it("sin prepago → confirmed + appointment/confirmed + /listo sin pago", () => {
    const out = decideBookingOutcome({ ...base, paymentMode: "at_visit", checkout: null });
    expect(out).toEqual({
      kind: "confirmed",
      finalStatus: "confirmed",
      emit: { name: "appointment/confirmed" },
      redirectTo: "/karla/agendar/listo?cita=tok_abc-123",
      degraded: false,
    });
  });

  it("tarjeta OK → pending_payment, redirige a Stripe, expira con la sesión", () => {
    const expiresAt = new Date(now.getTime() + 30 * 60_000);
    const out = decideBookingOutcome({
      ...base,
      paymentMode: "prepaid",
      checkout: { ok: true, method: "card", result: { paymentId: "p1", url: "https://checkout.stripe.com/c/x", expiresAt } },
    });
    expect(out).toEqual({
      kind: "awaiting_payment",
      finalStatus: "pending_payment",
      emit: { name: "appointment/pending_payment", expiresAt: expiresAt.toISOString() },
      redirectTo: "https://checkout.stripe.com/c/x",
      external: true,
    });
  });

  it("tarjeta sin expiresAt del proveedor → +1 h", () => {
    const out = decideBookingOutcome({
      ...base,
      paymentMode: "prepaid",
      checkout: { ok: true, method: "card", result: { paymentId: "p1", url: "https://stripe" } },
    });
    expect(out.kind).toBe("awaiting_payment");
    if (out.kind !== "awaiting_payment") return;
    expect(out.emit.expiresAt).toBe(new Date(now.getTime() + CARD_PAYMENT_TTL_MS).toISOString());
  });

  it.each(["spei", "oxxo"] as const)("%s OK → pending_payment y /listo?pago=pendiente (link a /pago/[id])", (method) => {
    const expiresAt = new Date(now.getTime() + 24 * 3_600_000);
    const out = decideBookingOutcome({
      ...base,
      paymentMode: "prepaid",
      checkout: { ok: true, method, result: { paymentId: "p2", url: "https://mp/ticket", expiresAt } },
    });
    expect(out).toMatchObject({
      kind: "awaiting_payment",
      finalStatus: "pending_payment",
      emit: { name: "appointment/pending_payment", expiresAt: expiresAt.toISOString() },
      redirectTo: "/karla/agendar/listo?cita=tok_abc-123&pago=pendiente",
      external: false,
    });
  });

  it("la expiración nunca pasa del inicio de la cita", () => {
    const soon = new Date(now.getTime() + 3 * 3_600_000);
    const out = decideBookingOutcome({
      ...base,
      startsAt: soon,
      paymentMode: "prepaid",
      checkout: {
        ok: true,
        method: "oxxo",
        result: { paymentId: "p3", url: "https://mp", expiresAt: new Date(now.getTime() + 48 * 3_600_000) },
      },
    });
    expect(out.kind === "awaiting_payment" && out.emit.expiresAt).toBe(soon.toISOString());
  });

  it("stripe_not_connected → degrada a confirmed + /listo?pago=consulta", () => {
    const out = decideBookingOutcome({
      ...base,
      paymentMode: "prepaid",
      checkout: { ok: false, error: new PaymentsError("stripe_not_connected", "Karla aún no conectó Stripe") },
    });
    expect(out).toEqual({
      kind: "confirmed",
      finalStatus: "confirmed",
      emit: { name: "appointment/confirmed" },
      redirectTo: "/karla/agendar/listo?cita=tok_abc-123&pago=consulta",
      degraded: true,
    });
  });

  it("faltan keys del proveedor (PaymentsNotConfiguredError) → también degrada", () => {
    const out = decideBookingOutcome({
      ...base,
      paymentMode: "prepaid",
      checkout: { ok: false, error: new PaymentsNotConfiguredError("mercadopago", "MP_ACCESS_TOKEN") },
    });
    expect(out.kind).toBe("confirmed");
    expect(out.kind === "confirmed" && out.degraded).toBe(true);
  });

  it.each([
    ["otro PaymentsError", new PaymentsError("no_session_url", "Stripe no devolvió URL")],
    ["error de red", new Error("fetch failed")],
    ["algo que no es Error", "boom"],
  ])("%s → borrar la cita y mostrar error", (_label, error) => {
    expect(decideBookingOutcome({ ...base, paymentMode: "prepaid", checkout: { ok: false, error } })).toEqual({
      kind: "failed",
      deleteAppointment: true,
      error: CHECKOUT_FAILED_ERROR,
    });
  });
});

describe("isPaymentsUnavailableError (contrato con @granola/payments)", () => {
  it("reconoce las clases reales por name/code", () => {
    expect(isPaymentsUnavailableError(new PaymentsNotConfiguredError("stripe", "STRIPE_SECRET_KEY"))).toBe(true);
    expect(isPaymentsUnavailableError(new PaymentsError("stripe_not_connected", "x"))).toBe(true);
    expect(isPaymentsUnavailableError(new PaymentsError("nutritionist_not_found", "x"))).toBe(false);
    expect(isPaymentsUnavailableError(null)).toBe(false);
  });
});
