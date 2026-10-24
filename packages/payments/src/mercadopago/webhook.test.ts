import { describe, expect, it } from "vitest";

import { extractMpInstructions, type PaymentResponse } from "./instructions";
import { isMpPaymentNotification, mpNotificationSchema, mpPaymentIdFrom } from "./webhook";

describe("notificación de Mercado Pago", () => {
  it("formato Webhooks v2: type=payment + data.id numérico", () => {
    const body = mpNotificationSchema.parse({
      id: 12345,
      live_mode: false,
      type: "payment",
      date_created: "2024-01-10T17:33:30Z",
      user_id: 44444,
      api_version: "v1",
      action: "payment.updated",
      data: { id: 999888777 },
    });
    expect(isMpPaymentNotification(body)).toBe(true);
    expect(mpPaymentIdFrom(body, null)).toBe("999888777");
  });

  it("formato IPN viejo: topic=payment + resource URL", () => {
    const body = mpNotificationSchema.parse({
      topic: "payment",
      resource: "https://api.mercadolibre.com/v1/payments/555444333",
    });
    expect(isMpPaymentNotification(body)).toBe(true);
    expect(mpPaymentIdFrom(body, null)).toBe("555444333");
  });

  it("usa data.id de la query si el body no lo trae", () => {
    const body = mpNotificationSchema.parse({ type: "payment" });
    expect(mpPaymentIdFrom(body, "123")).toBe("123");
    expect(mpPaymentIdFrom(body, null)).toBeNull();
  });

  it("ignora merchant_order y otros topics", () => {
    expect(isMpPaymentNotification(mpNotificationSchema.parse({ type: "merchant_order", data: { id: 1 } }))).toBe(false);
    expect(isMpPaymentNotification(mpNotificationSchema.parse({ topic: "plan" }))).toBe(false);
  });
});

describe("extractMpInstructions", () => {
  const base = {
    api_response: { status: 200, headers: {} as Record<string, string[]> },
    id: 123456,
    status: "pending",
    status_detail: "pending_waiting_transfer",
    transaction_amount: 800,
    date_of_expiration: "2026-10-25T12:00:00.000-06:00",
  };

  it("SPEI (clabe): CLABE y banco", () => {
    const res = extractMpInstructions({
      ...base,
      payment_method_id: "clabe",
      transaction_details: { payment_method_reference_id: "646180111812345678", financial_institution: "STP" },
      point_of_interaction: {
        type: "BANK_TRANSFER",
        transaction_data: { bank_info: { collector: { long_name: "Mercado Pago W" } } },
      },
    } as unknown as PaymentResponse);
    expect(res).toMatchObject({
      mpPaymentId: "123456",
      method: "spei",
      amountCents: 80000,
      clabe: "646180111812345678",
      bankName: "Mercado Pago W",
      reference: null,
    });
    expect(res?.expiresAt?.toISOString()).toBe("2026-10-25T18:00:00.000Z");
  });

  it("OXXO: ticket_url y referencia", () => {
    const res = extractMpInstructions({
      ...base,
      payment_method_id: "oxxo",
      transaction_details: {
        payment_method_reference_id: "9700000012345678",
        external_resource_url: "https://www.mercadopago.com.mx/payments/123456/ticket",
      },
    } as unknown as PaymentResponse);
    expect(res).toMatchObject({
      method: "oxxo",
      reference: "9700000012345678",
      clabe: null,
      ticketUrl: "https://www.mercadopago.com.mx/payments/123456/ticket",
    });
  });

  it("devuelve null para métodos que no son SPEI/OXXO", () => {
    expect(extractMpInstructions({ ...base, payment_method_id: "visa" } as unknown as PaymentResponse)).toBeNull();
  });
});
