import { describe, expect, it } from "vitest";
import {
  buildCitaCancelada,
  buildCitaConfirmada,
  buildCitaReagendada,
  buildNuevaCitaNutri,
  buildPagoPendienteOxxo,
  buildPideResena,
  buildRecordatorio24h,
  buildRecordatorio2h,
  param,
} from "./index";

const TZ = "America/Mexico_City";
const startsAt = new Date("2026-10-29T16:00:00.000Z"); // jueves 29 oct, 10:00 a.m. CDMX
const base = {
  patientName: "Ana López",
  nutritionistName: "Karla Demo",
  startsAt,
  timeZone: TZ,
  modality: "online" as const,
  meetUrl: "https://meet.google.com/abc-defg-hij",
  cancelToken: "tok_123",
};

function bodyTexts(components: { type: string; parameters: { type: string }[] }[]): string[] {
  const b = components.find((c) => c.type === "body");
  return (b?.parameters ?? []).map((p) => (p as unknown as { text: string }).text);
}

describe("builders de plantillas", () => {
  it("cita_confirmada", () => {
    const t = buildCitaConfirmada(base);
    expect(t.name).toBe("cita_confirmada");
    expect(t.language).toBe("es_MX");
    expect(bodyTexts(t.components)).toEqual([
      "Ana López",
      "Karla Demo",
      expect.stringMatching(/^jueves 29 de octubre( de 2026)?, 10:00 a\.m\.$/),
      "en línea",
      "Te conectas aquí: https://meet.google.com/abc-defg-hij",
    ]);
    expect(t.components[1]).toEqual({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: "tok_123" }],
    });
  });

  it("cita_confirmada presencial usa la dirección", () => {
    const t = buildCitaConfirmada({ ...base, modality: "presencial", meetUrl: null, location: "Av. Reforma 123, CDMX" });
    expect(bodyTexts(t.components)[3]).toBe("presencial");
    expect(bodyTexts(t.components)[4]).toBe("Dirección: Av. Reforma 123, CDMX");
  });

  it("online sin link de Meet no manda parámetro vacío", () => {
    const t = buildCitaConfirmada({ ...base, meetUrl: null });
    expect(bodyTexts(t.components)[4]).toMatch(/link de la videollamada/);
  });

  it("recordatorio_24h lleva quick reply Confirmo + URL Reagendar", () => {
    const t = buildRecordatorio24h({ ...base, appointmentId: "5f3c1b2a-0000-4000-8000-000000000001" });
    expect(bodyTexts(t.components)[2]).toBe("10:00 a.m.");
    expect(t.components[1]).toEqual({
      type: "button",
      sub_type: "quick_reply",
      index: "0",
      parameters: [{ type: "payload", payload: "confirm:5f3c1b2a-0000-4000-8000-000000000001" }],
    });
    expect(t.components[2]).toMatchObject({ sub_type: "url", index: "1" });
  });

  it("recordatorio_2h", () => {
    const t = buildRecordatorio2h(base);
    expect(t.name).toBe("recordatorio_2h");
    expect(bodyTexts(t.components)).toHaveLength(5);
  });

  it("cita_cancelada varía el motivo según quién cancela", () => {
    const by = (b: "patient" | "nutritionist" | "system") =>
      bodyTexts(buildCitaCancelada({ ...base, by: b, nutritionistSlug: "karla" }).components)[3];
    expect(by("patient")).toBe("a petición tuya");
    expect(by("nutritionist")).toBe("por Karla Demo");
    expect(by("system")).toBe("porque no se completó el pago a tiempo");
    const t = buildCitaCancelada({ ...base, by: "patient", nutritionistSlug: "karla" });
    expect(t.components[1]).toMatchObject({ sub_type: "url", parameters: [{ type: "text", text: "karla" }] });
  });

  it("cita_reagendada incluye fecha anterior y nueva", () => {
    const t = buildCitaReagendada({ ...base, previousStartsAt: new Date("2026-10-27T16:00:00.000Z") });
    const texts = bodyTexts(t.components);
    expect(texts[2]).toMatch(/^martes 27 de octubre/);
    expect(texts[3]).toMatch(/^jueves 29 de octubre/);
    expect(texts).toHaveLength(6);
  });

  it("pago_pendiente_oxxo formatea monto y límite", () => {
    const t = buildPagoPendienteOxxo({
      ...base,
      amountCents: 65000,
      expiresAt: new Date("2026-10-25T16:00:00.000Z"),
    });
    const texts = bodyTexts(t.components);
    expect(texts[3]).toBe("$650.00 MXN");
    expect(texts[4]).toMatch(/^domingo 25 de octubre/);
  });

  it("pide_resena", () => {
    const t = buildPideResena(base);
    expect(bodyTexts(t.components)).toEqual(["Ana López", "Karla Demo"]);
    expect(t.components[1]).toMatchObject({ sub_type: "url", parameters: [{ type: "text", text: "tok_123" }] });
  });

  it("nueva_cita_nutri", () => {
    const t = buildNuevaCitaNutri({
      appointmentId: "5f3c1b2a-0000-4000-8000-000000000001",
      patientName: "Ana López",
      serviceName: "Primera consulta",
      startsAt,
      timeZone: TZ,
      modality: "presencial",
      paymentLabel: "pagado con tarjeta",
    });
    expect(bodyTexts(t.components)).toEqual([
      "Ana López",
      "Primera consulta",
      expect.stringMatching(/^jueves 29 de octubre/),
      "presencial",
      "pagado con tarjeta",
    ]);
    expect(t.components[1]).toMatchObject({ parameters: [{ type: "text", text: "5f3c1b2a-0000-4000-8000-000000000001" }] });
  });

  it("param() limpia saltos de línea y espacios múltiples (regla de Meta)", () => {
    expect(param("Hola\n\nmundo\tya")).toBe("Hola mundo ya");
    expect(param("a        b")).toBe("a   b");
    expect(param("")).toBe("-");
    expect(param("x".repeat(2000), 10)).toHaveLength(10);
  });
});
