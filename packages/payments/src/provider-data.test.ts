import { describe, expect, it } from "vitest";

import { extractMpInstructions, type PaymentResponse } from "./mercadopago/instructions";
import {
  failureReasonFor,
  isProviderDataEmpty,
  mpInstructionsToProviderData,
  providerDataToMpInstructions,
  stripeSessionToProviderData,
} from "./provider-data";
import { accountStatusFromColumns, accountStatusToColumns, type ConnectAccountStatus } from "./stripe/connect";
import { shouldApplyTransition } from "./status";

// Fixtures recortadas de respuestas reales de POST /v1/payments (sandbox MX).
const speiResponse = {
  id: 1_324_567_890,
  status: "pending",
  status_detail: "pending_waiting_transfer",
  payment_method_id: "clabe",
  transaction_amount: 800,
  date_of_expiration: "2026-10-25T18:00:00.000+00:00",
  transaction_details: {
    payment_method_reference_id: "646180157000000004",
    financial_institution: "STP",
    external_resource_url: null,
  },
  point_of_interaction: {
    transaction_data: {
      ticket_url: "https://www.mercadopago.com.mx/payments/1324567890/ticket",
      bank_info: { collector: { long_name: "Sistema de Transferencias y Pagos STP" } },
    },
  },
} as unknown as PaymentResponse;

const oxxoResponse = {
  id: 9_876_543_210,
  status: "pending",
  status_detail: "pending_waiting_payment",
  payment_method_id: "oxxo",
  transaction_amount: 650.5,
  date_of_expiration: "2026-10-26T18:00:00.000+00:00",
  transaction_details: {
    payment_method_reference_id: "98000012345678",
    external_resource_url: "https://www.mercadopago.com.mx/payments/9876543210/ticket?caller_id=1",
  },
  barcode: { content: "QkFSQ09ERQ==" },
} as unknown as PaymentResponse;

describe("mpInstructionsToProviderData", () => {
  it("SPEI guarda CLABE, banco, ticket y status; sin referencia OXXO", () => {
    const data = mpInstructionsToProviderData(extractMpInstructions(speiResponse)!);
    expect(data).toEqual({
      providerId: "1324567890",
      clabe: "646180157000000004",
      bankName: "Sistema de Transferencias y Pagos STP",
      reference: null,
      ticketUrl: "https://www.mercadopago.com.mx/payments/1324567890/ticket",
      barcodeBase64: null,
      providerStatus: "pending",
      providerStatusDetail: "pending_waiting_transfer",
    });
  });

  it("OXXO guarda referencia, ficha (external_resource_url) y código de barras; sin CLABE", () => {
    const data = mpInstructionsToProviderData(extractMpInstructions(oxxoResponse)!);
    expect(data.clabe).toBeNull();
    expect(data.reference).toBe("98000012345678");
    expect(data.ticketUrl).toBe("https://www.mercadopago.com.mx/payments/9876543210/ticket?caller_id=1");
    expect(data.barcodeBase64).toBe("QkFSQ09ERQ==");
    expect(data.providerId).toBe("9876543210");
  });
});

describe("providerDataToMpInstructions (lo que lee /pago/[id])", () => {
  const base = { providerRef: "1324567890", amountCents: 80_000, expiresAt: new Date("2026-10-25T18:00:00Z") };

  it("ida y vuelta SPEI sin consultar a MP", () => {
    const original = extractMpInstructions(speiResponse)!;
    const back = providerDataToMpInstructions({
      ...base,
      method: "spei",
      providerData: mpInstructionsToProviderData(original),
    });
    expect(back).toEqual({ ...original, expiresAt: base.expiresAt });
  });

  it("provider_data vacío ({} default) → null para que la página consulte a MP", () => {
    expect(providerDataToMpInstructions({ ...base, method: "spei", providerData: {} })).toBeNull();
    expect(isProviderDataEmpty({})).toBe(true);
    expect(isProviderDataEmpty({ providerId: "123", providerStatus: "pending" })).toBe(true);
  });

  it("SPEI sin CLABE no sirve → null; tarjeta/efectivo → null", () => {
    expect(
      providerDataToMpInstructions({ ...base, method: "spei", providerData: { ticketUrl: "https://x" } }),
    ).toBeNull();
    expect(
      providerDataToMpInstructions({ ...base, method: "card", providerData: { sessionUrl: "https://x" } }),
    ).toBeNull();
  });

  it("OXXO con solo ficha basta; usa providerRef si falta providerId", () => {
    const res = providerDataToMpInstructions({
      ...base,
      method: "oxxo",
      providerData: { ticketUrl: "https://ficha" },
    });
    expect(res?.mpPaymentId).toBe("1324567890");
    expect(res?.ticketUrl).toBe("https://ficha");
    expect(res?.reference).toBeNull();
  });
});

describe("stripeSessionToProviderData", () => {
  it("guarda url de la sesión e id; payment_intent string u objeto", () => {
    expect(
      stripeSessionToProviderData({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1", status: "open" }),
    ).toEqual({
      providerId: "cs_test_1",
      sessionUrl: "https://checkout.stripe.com/c/pay/cs_test_1",
      paymentIntentId: null,
      providerStatus: "open",
    });
    expect(stripeSessionToProviderData({ id: "cs_1", url: null, payment_intent: "pi_1" }).paymentIntentId).toBe("pi_1");
    expect(stripeSessionToProviderData({ id: "cs_1", url: null, payment_intent: { id: "pi_2" } }).paymentIntentId).toBe(
      "pi_2",
    );
  });
});

describe("failureReasonFor", () => {
  it("solo para failed/expired", () => {
    expect(failureReasonFor("paid", { provider: "stripe", eventType: "checkout.session.completed" })).toBeNull();
    expect(failureReasonFor(null, { provider: "mercadopago", status: "pending" })).toBeNull();
  });

  it("MP usa status_detail (o status)", () => {
    expect(failureReasonFor("failed", { provider: "mercadopago", status: "rejected", statusDetail: "cc_rejected_high_risk" })).toBe(
      "mp:cc_rejected_high_risk",
    );
    expect(failureReasonFor("expired", { provider: "mercadopago", status: "cancelled", statusDetail: "expired" })).toBe(
      "mp:expired",
    );
    expect(failureReasonFor("failed", { provider: "mercadopago", status: "rejected", statusDetail: null })).toBe("mp:rejected");
  });

  it("Stripe distingue sesión vencida de pago asíncrono fallido", () => {
    expect(failureReasonFor("expired", { provider: "stripe", eventType: "checkout.session.expired" })).toBe(
      "stripe:session_expired",
    );
    expect(failureReasonFor("failed", { provider: "stripe", eventType: "checkout.session.async_payment_failed" })).toBe(
      "stripe:async_payment_failed",
    );
  });
});

describe("expired no retrocede a failed (cancelación en MP tras expirar)", () => {
  it("expired → failed no se aplica; expired → paid sí", () => {
    expect(shouldApplyTransition("expired", "failed")).toBe(false);
    expect(shouldApplyTransition("expired", "paid")).toBe(true);
  });
});

describe("flags de Stripe Connect en nutritionists", () => {
  const status: ConnectAccountStatus = {
    accountId: "acct_123",
    chargesEnabled: true,
    payoutsEnabled: false,
    detailsSubmitted: true,
    currentlyDue: ["external_account"],
    eventuallyDue: [],
    pastDue: [],
    disabledReason: null,
  };

  it("columnas ↔ status ida y vuelta", () => {
    const now = new Date("2026-10-24T12:00:00Z");
    const cols = accountStatusToColumns(status, now);
    expect(cols.stripeChargesEnabled).toBe(true);
    expect(cols.stripePayoutsEnabled).toBe(false);
    expect(cols.stripeRequirements.syncedAt).toBe(now.toISOString());
    expect(accountStatusFromColumns({ stripeAccountId: "acct_123", ...cols })).toEqual({
      ...status,
      syncedAt: now.toISOString(),
    });
  });

  it("requirements vacío ({} default) → listas vacías", () => {
    const s = accountStatusFromColumns({
      stripeAccountId: "acct_1",
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeRequirements: {},
    });
    expect(s.currentlyDue).toEqual([]);
    expect(s.detailsSubmitted).toBe(false);
    expect(s.syncedAt).toBeNull();
  });
});
