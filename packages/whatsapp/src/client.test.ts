import { describe, expect, it, vi } from "vitest";
import { createWhatsAppClient } from "./client";
import { buildPideResena } from "./templates";
import { WhatsAppApiError } from "./types";

const tpl = buildPideResena({ patientName: "Ana", nutritionistName: "Karla", cancelToken: "tok" });

describe("createWhatsAppClient", () => {
  it("dry run sin token: no llama a fetch, loguea y devuelve waMessageId null", async () => {
    const fetchMock = vi.fn();
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const client = createWhatsAppClient({ accessToken: undefined, phoneNumberId: "123", fetch: fetchMock, logger });
    expect(client.dryRun).toBe(true);
    const r = await client.sendTemplate({ to: "33 1234 5678", template: tpl });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ waMessageId: null, dryRun: true, request: { to: "523312345678", type: "template" } });
  });

  it("envío real: arma el request de Graph y regresa el wamid", async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(body).toMatchObject({
        messaging_product: "whatsapp",
        to: "523312345678",
        type: "template",
        template: { name: "pide_resena", language: { code: "es_MX" } },
      });
      return new Response(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: "wamid.ABC" }] }), { status: 200 });
    });
    const client = createWhatsAppClient({ accessToken: "tok", phoneNumberId: "999", graphVersion: "v21.0", fetch: fetchMock as typeof fetch });
    const r = await client.sendTemplate({ to: "+52 1 33 1234 5678", template: tpl });
    expect(fetchMock).toHaveBeenCalledWith("https://graph.facebook.com/v21.0/999/messages", expect.objectContaining({ method: "POST" }));
    const headers = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(r).toMatchObject({ waMessageId: "wamid.ABC", dryRun: false });
  });

  it("error de Graph → WhatsAppApiError con code y retriable", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ error: { message: "(#131047) Re-engagement message", code: 131047, type: "OAuthException" } }), { status: 400 }),
    );
    const client = createWhatsAppClient({ accessToken: "tok", phoneNumberId: "999", fetch: fetchMock as typeof fetch });
    const err = await client.sendText({ to: "55 3312 3456", body: "hola" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(WhatsAppApiError);
    expect(err as WhatsAppApiError).toMatchObject({ code: 131047, httpStatus: 400, retriable: false });

    const fetch500 = vi.fn(async () => new Response("{}", { status: 503 }));
    const c2 = createWhatsAppClient({ accessToken: "tok", phoneNumberId: "999", fetch: fetch500 as typeof fetch });
    const e2 = (await c2.markRead("wamid.X").catch((e: unknown) => e)) as WhatsAppApiError;
    expect(e2.retriable).toBe(true);
  });

  it("teléfono inválido falla antes de llamar a Meta", async () => {
    const fetchMock = vi.fn();
    const client = createWhatsAppClient({ accessToken: "tok", phoneNumberId: "999", fetch: fetchMock });
    await expect(client.sendTemplate({ to: "12345", template: tpl })).rejects.toMatchObject({ code: 131026 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
