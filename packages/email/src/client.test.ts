import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmailClient, EmailApiError, sendEmail } from "./client";

const input = { to: "ana@example.test", subject: "Prueba", html: "<p>Contenido privado</p>", text: "Contenido privado", tags: [{ name: "template", value: "prueba" }] };
const logger = { info: vi.fn(), error: vi.fn() };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("RESEND_API_KEY", ""); vi.stubEnv("EMAIL_FROM", ""); });

describe("cliente Resend", () => {
  it("sin token hace dry run, no usa fetch y devuelve id null", async () => {
    const fetch = vi.fn();
    const result = await createEmailClient({ fetch, logger }).sendEmail(input);
    expect(result).toEqual({ id: null, dryRun: true });
    expect(fetch).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith("[email:dry-run]", { recipientCount: 1 });
    const log = JSON.stringify(logger.info.mock.calls);
    expect(log).not.toContain(input.to);
    expect(log).not.toContain(input.text);
  });
  it("el export sendEmail también funciona sin env al importar", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    expect(await sendEmail(input)).toEqual({ id: null, dryRun: true });
  });
  it("envía por fetch directo con EMAIL_FROM, texto, tags e idempotencia", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key"); vi.stubEnv("EMAIL_FROM", "Granola <hola@granola.app>");
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-123" }), { status: 200 }));
    expect(await createEmailClient({ fetch, logger }).sendEmail({ ...input, idempotencyKey: "confirmed-123-patient" })).toEqual({ id: "email-123", dryRun: false });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, options] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.headers).toMatchObject({ Authorization: "Bearer re_test_key", "Idempotency-Key": "confirmed-123-patient" });
    expect(JSON.parse(options.body)).toEqual({ from: "Granola <hola@granola.app>", ...input });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain("re_test_key");
  });
  it.each([400, 401, 422, 429, 500])("clasifica el HTTP %s sin filtrar la respuesta", async (status) => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key"); vi.stubEnv("EMAIL_FROM", "hola@granola.app");
    const fetch = vi.fn().mockResolvedValue(new Response("secreto del proveedor", { status }));
    const error = await createEmailClient({ fetch, logger }).sendEmail(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EmailApiError);
    expect(error).toMatchObject({ httpStatus: status, retriable: status === 429 || status >= 500 });
    expect(String(error)).not.toContain("secreto");
  });
  it("un fallo de red se puede reintentar", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key"); vi.stubEnv("EMAIL_FROM", "hola@granola.app");
    const fetch = vi.fn().mockRejectedValue(new Error("detalles privados"));
    await expect(createEmailClient({ fetch, logger }).sendEmail(input)).rejects.toMatchObject({ httpStatus: 0, retriable: true });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain("detalles privados");
  });
  it("rechaza respuesta exitosa sin id", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key"); vi.stubEnv("EMAIL_FROM", "hola@granola.app");
    const fetch = vi.fn().mockResolvedValue(new Response("{}"));
    await expect(createEmailClient({ fetch, logger }).sendEmail(input)).rejects.toMatchObject({ httpStatus: 502 });
  });
  it("valida las fronteras antes de enviar", async () => {
    const fetch = vi.fn();
    const client = createEmailClient({ fetch, logger });
    await expect(client.sendEmail({ ...input, to: "no-es-correo" })).rejects.toThrow();
    await expect(client.sendEmail({ ...input, subject: "Asunto\r\nBcc:otro@example.test" })).rejects.toThrow();
    await expect(client.sendEmail({ ...input, tags: [{ name: "template", value: "con espacio" }] })).rejects.toThrow();
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    await expect(client.sendEmail(input)).rejects.toThrow();
    vi.stubEnv("EMAIL_FROM", "Granola <hola@granola.app>\r\nBcc:otro@example.test");
    await expect(client.sendEmail(input)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
});
