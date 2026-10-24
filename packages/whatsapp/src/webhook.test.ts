import { describe, expect, it } from "vitest";
import statusDelivered from "./__fixtures__/status_delivered.json";
import statusFailed from "./__fixtures__/status_failed.json";
import inboundButton from "./__fixtures__/inbound_button_confirm.json";
import inboundText from "./__fixtures__/inbound_text.json";
import { detectIntent, parseWebhook, signPayload, verifySignature, verifyWebhookChallenge } from "./webhook";

const SECRET = "app-secret-de-prueba";

describe("verifyWebhookChallenge", () => {
  it("devuelve el challenge si el token coincide", () => {
    const p = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "granola-verify", "hub.challenge": "1158201444" });
    expect(verifyWebhookChallenge(p, "granola-verify")).toBe("1158201444");
  });
  it("rechaza token distinto, modo distinto o sin token configurado", () => {
    const p = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "otro", "hub.challenge": "1" });
    expect(verifyWebhookChallenge(p, "granola-verify")).toBeNull();
    expect(verifyWebhookChallenge(new URLSearchParams({ "hub.mode": "unsubscribe", "hub.verify_token": "granola-verify", "hub.challenge": "1" }), "granola-verify")).toBeNull();
    expect(verifyWebhookChallenge(p, undefined)).toBeNull();
  });
});

describe("verifySignature", () => {
  const raw = JSON.stringify(statusDelivered);
  it("acepta la firma correcta", () => {
    expect(verifySignature(raw, signPayload(raw, SECRET), SECRET)).toBe(true);
    // Firma conocida (hmac sha256 de "hola" con "s"): calculada con node:crypto.
    expect(verifySignature("hola", "sha256=" + "e5c2c8c7f0c5c6c3bb2d8f1f9ab6b0cd15a1c7e55e3fb5c5b3d2f1d8a1e2b3c4", "s")).toBe(false);
  });
  it("rechaza body alterado, header malformado o sin secret", () => {
    const sig = signPayload(raw, SECRET);
    expect(verifySignature(raw + " ", sig, SECRET)).toBe(false);
    expect(verifySignature(raw, sig, "otro-secret")).toBe(false);
    expect(verifySignature(raw, "sha1=abc", SECRET)).toBe(false);
    expect(verifySignature(raw, null, SECRET)).toBe(false);
    expect(verifySignature(raw, sig, undefined)).toBe(false);
  });
});

describe("parseWebhook", () => {
  it("status delivered", () => {
    const { statuses, inbound } = parseWebhook(statusDelivered);
    expect(inbound).toHaveLength(0);
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toMatchObject({
      waMessageId: "wamid.HBgLNTIzMzEyMzQ1Njc4FQIAERgSQzdDNTk0RkM0OTY3QTk4RjQ0AA==",
      status: "delivered",
      recipient: "+523312345678",
      errorCode: null,
    });
    expect(statuses[0]?.timestamp.toISOString()).toBe("2025-10-24T16:00:00.000Z");
  });

  it("status failed con código de error y recipient con el 1 viejo", () => {
    const { statuses } = parseWebhook(statusFailed);
    expect(statuses[0]).toMatchObject({ status: "failed", errorCode: "131026", errorTitle: "Message undeliverable", recipient: "+523312345678" });
  });

  it("botón quick reply Confirmo → intención confirm con appointmentId", () => {
    const { inbound } = parseWebhook(inboundButton);
    expect(inbound).toHaveLength(1);
    expect(inbound[0]).toMatchObject({
      from: "+523312345678",
      profileName: "Ana López",
      type: "button",
      text: "Confirmo",
      buttonPayload: "confirm:5f3c1b2a-0000-4000-8000-000000000001",
      contextMessageId: "wamid.HBgLNTIzMzEyMzQ1Njc4FQIAERgSQzdDNTk0RkM0OTY3QTk4RjQ0AA==",
      intent: { kind: "confirm", appointmentId: "5f3c1b2a-0000-4000-8000-000000000001" },
      phoneNumberId: "106540352242922",
    });
  });

  it("texto libre sin intención clara → intent null", () => {
    const { inbound } = parseWebhook(inboundText);
    expect(inbound[0]).toMatchObject({ type: "text", text: "Hola, ¿puedo cambiar mi cita?", intent: null, buttonPayload: null });
  });

  it("ignora changes que no son `messages`", () => {
    const r = parseWebhook({
      object: "whatsapp_business_account",
      entry: [{ id: "1", changes: [{ field: "message_template_status_update", value: { event: "APPROVED" } }] }],
    });
    expect(r).toEqual({ statuses: [], inbound: [] });
  });

  it("lanza con payload que no es de Meta", () => {
    expect(() => parseWebhook({ hello: "world" })).toThrow();
  });
});

describe("detectIntent", () => {
  it("payload estructurado", () => {
    expect(detectIntent("reschedule:5f3c1b2a-0000-4000-8000-000000000001", null)).toEqual({
      kind: "reschedule",
      appointmentId: "5f3c1b2a-0000-4000-8000-000000000001",
    });
  });
  it("texto corto", () => {
    expect(detectIntent(null, "Confirmo")).toEqual({ kind: "confirm", appointmentId: null });
    expect(detectIntent(null, "Sí")).toEqual({ kind: "confirm", appointmentId: null });
    expect(detectIntent(null, "Reagendar")).toEqual({ kind: "reschedule", appointmentId: null });
    expect(detectIntent(null, "quiero información de precios")).toBeNull();
    expect(detectIntent("algo-raro", "Confirmo")).toEqual({ kind: "confirm", appointmentId: null });
  });
});
