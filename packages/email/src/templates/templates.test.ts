import { describe, expect, it } from "vitest";
import { bienvenida, citaCancelada, citaConfirmadaPaciente, magicLink, nuevaCitaNutri } from "./index";

const appointment = {
  patientName: "Ana López", nutritionistName: "Karla Demo", serviceName: "Seguimiento",
  startsAt: new Date("2026-10-24T16:00:00Z"), timeZone: "America/Mexico_City",
  modality: "online" as const, meetUrl: "https://meet.google.com/demo", location: null,
  manageUrl: "https://granola.app/cita/token-de-prueba",
};

describe("plantillas de correo", () => {
  const examples = [
    ["magicLink", () => magicLink({ url: "https://granola.app/api/auth/magic-link/verify?token=demo" })],
    ["bienvenida", () => bienvenida({ name: "Karla", appUrl: "https://granola.app/app" })],
    ["citaConfirmadaPaciente", () => citaConfirmadaPaciente(appointment)],
    ["nuevaCitaNutri", () => nuevaCitaNutri({ ...appointment, manageUrl: "https://granola.app/app/agenda/id-demo" })],
    ["citaCancelada", () => citaCancelada({ ...appointment, meetUrl: null, manageUrl: "https://granola.app/karla/agendar" })],
  ] as const;
  it.each(examples)("%s conserva el texto aprobado y usa la paleta sin imágenes", (_name, template) => {
    const result = template();
    expect(result.text).toMatchSnapshot();
    expect(result.html).toContain("#FBF7F0");
    expect(result.html).toContain("#2B2118");
    expect(result.html).toContain("#4A7A2B");
    expect(result.html).not.toMatch(/<img|<script|<link|@import/i);
    expect(result.html).toContain(result.subject);
  });
  it("escapa nombres, ubicaciones y parámetros HTML", () => {
    const result = citaConfirmadaPaciente({ ...appointment, patientName: '<script>alert("x")</script>',
      modality: "presencial", location: "Consultorio <A> & B", manageUrl: "https://granola.app/cita/t?a=1&b=2" });
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
    expect(result.html).toContain("Consultorio &lt;A&gt; &amp; B");
    expect(result.html).toContain("?a=1&amp;b=2");
    expect(result.text).toContain("Consultorio <A> & B");
    expect(result.text).not.toContain("Videollamada:");
  });
  it("valida URL, fecha y zona horaria", () => {
    expect(() => magicLink({ url: "javascript:alert(1)" })).toThrow();
    expect(() => bienvenida({ name: "Karla", appUrl: "data:text/html,payload" })).toThrow();
    expect(() => citaConfirmadaPaciente({ ...appointment, startsAt: new Date("inválida") })).toThrow();
    expect(() => citaConfirmadaPaciente({ ...appointment, timeZone: "zona-inválida" })).toThrow();
  });
  it("renderiza el mismo instante en la zona de cada destinatario", () => {
    expect(citaConfirmadaPaciente({ ...appointment, timeZone: "America/Tijuana" }).text).toContain("9:00");
    expect(nuevaCitaNutri(appointment).text).toContain("10:00");
  });
});
