import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calendarEventId, GoogleCalendarClient, GoogleCalendarError, type CalendarEventInput } from "./client";
import { encryptRefreshToken } from "./crypto";

const fetchMock = vi.fn<typeof fetch>();
const input: CalendarEventInput = {
  appointmentId: "a0000000-0000-4000-8000-000000000001", startsAt: "2026-11-04T16:00:00Z", endsAt: "2026-11-04T17:00:00Z", timeZone: "America/Mexico_City", modality: "online",
};
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const token = () => fetchMock.mockResolvedValueOnce(response({ access_token: "access", expires_in: 3600 }));
function client() { return new GoogleCalendarClient(encryptRefreshToken("refresh-secret")); }
beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "client"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("GOOGLE_TOKEN_ENC_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("Cliente Google Calendar sin SDK", () => {
  it("renueva access_token usando el refresh descifrado solo en la petición OAuth", async () => {
    token(); expect(await client().refreshAccessToken()).toBe("access");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init?.body).toBeInstanceOf(URLSearchParams);
    expect((init?.body as URLSearchParams).get("refresh_token")).toBe("refresh-secret");
    expect((init?.body as URLSearchParams).get("grant_type")).toBe("refresh_token");
  });
  it("crea online con conferenceData, ID estable y Authorization", async () => {
    token(); fetchMock.mockResolvedValueOnce(response({ id: calendarEventId(input.appointmentId), hangoutLink: "https://meet.google.com/abc-defg-hij" }));
    expect(await client().createEvent(input)).toMatchObject({ meetUrl: "https://meet.google.com/abc-defg-hij" });
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toContain("conferenceDataVersion=1"); expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer access" });
    expect(JSON.parse(String(init?.body))).toMatchObject({ id: calendarEventId(input.appointmentId), summary: "Consulta Granola", conferenceData: { createRequest: { conferenceSolutionKey: { type: "hangoutsMeet" } } } });
  });
  it("no solicita Meet para una cita presencial", async () => {
    token(); fetchMock.mockResolvedValueOnce(response({ id: "event" }));
    expect(await client().createEvent({ ...input, modality: "presencial" })).toEqual({ id: "event", meetUrl: null });
    expect(JSON.parse(String(fetchMock.mock.calls[1]![1]?.body))).not.toHaveProperty("conferenceData");
  });
  it("reconcilia el evento existente ante un 409 en vez de duplicarlo", async () => {
    token(); fetchMock.mockResolvedValueOnce(response({}, 409)).mockResolvedValueOnce(response({ id: "stable", hangoutLink: "https://meet.google.com/abc-defg-hij" }));
    expect(await client().createEvent(input)).toMatchObject({ id: "stable" });
    expect(fetchMock.mock.calls[2]![0]).toContain(calendarEventId(input.appointmentId));
    expect(fetchMock.mock.calls[2]![1]?.method).toBe("PATCH");
  });
  it("consulta de nuevo cuando Meet está pending", async () => {
    token(); fetchMock.mockResolvedValueOnce(response({ id: "event", conferenceData: { createRequest: { status: { statusCode: "pending" } } } }))
      .mockResolvedValueOnce(response({ id: "event", conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }] } }));
    expect(await client().createEvent(input)).toMatchObject({ meetUrl: "https://meet.google.com/abc-defg-hij" });
  });
  it("mueve fechas con PATCH y preserva la conferencia", async () => {
    token(); fetchMock.mockResolvedValueOnce(response({ id: "event", hangoutLink: "https://meet.google.com/abc-defg-hij" }));
    await client().updateEvent("event", input);
    const [, init] = fetchMock.mock.calls[1]!;
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toMatchObject({ start: { dateTime: input.startsAt }, end: { dateTime: input.endsAt } });
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("conferenceData");
  });
  it.each([204, 404, 410])("delete es idempotente con HTTP %s", async (status) => {
    token(); fetchMock.mockResolvedValueOnce(new Response(null, { status }));
    await expect(client().deleteEvent("event")).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[1]![1]?.method).toBe("DELETE");
  });
  it("freeBusy devuelve intervalos Date del calendario primario", async () => {
    token(); fetchMock.mockResolvedValueOnce(response({ calendars: { primary: { busy: [{ start: input.startsAt, end: input.endsAt }] } } }));
    expect(await client().freeBusy(input.startsAt, input.endsAt)).toEqual([{ startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt) }]);
    expect(fetchMock.mock.calls[1]![0]).toMatch(/\/freeBusy$/);
  });
  it("propaga errores por calendario aunque HTTP sea 200", async () => {
    token(); fetchMock.mockResolvedValueOnce(response({ calendars: { primary: { errors: [{ reason: "notFound" }] } } }));
    await expect(client().freeBusy(input.startsAt, input.endsAt)).rejects.toBeInstanceOf(GoogleCalendarError);
  });
  it("al reagendar excluye solo el evento propio, no otro que se encima; incluye días completos y paginación", async () => {
    token(); fetchMock.mockResolvedValueOnce(response({ timeZone: "America/Mexico_City", nextPageToken: "page2", items: [
      { id: "own", start: { dateTime: input.startsAt }, end: { dateTime: input.endsAt } },
      { id: "other", start: { dateTime: input.startsAt }, end: { dateTime: input.endsAt } },
      { id: "free", transparency: "transparent" },
    ] })).mockResolvedValueOnce(response({ timeZone: "America/Mexico_City", items: [{ id: "day", start: { date: "2026-11-04" }, end: { date: "2026-11-05" } }] }));
    const busy = await client().freeBusy(input.startsAt, input.endsAt, "own");
    expect(busy).toHaveLength(2);
    expect(busy[1]).toEqual({ startsAt: new Date("2026-11-04T06:00:00Z"), endsAt: new Date("2026-11-05T06:00:00Z") });
    expect(fetchMock.mock.calls[2]![0]).toContain("pageToken=page2");
  });
  it("reutiliza el access token hasta su vencimiento y luego lo renueva", async () => {
    const api = client(); token(); fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await api.deleteEvent("one"); fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })); await api.deleteEvent("two");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 3_600_000);
    token(); fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 })); await api.deleteEvent("three");
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
  it("no expone cuerpos de Google en errores OAuth/API", async () => {
    fetchMock.mockResolvedValueOnce(response({ error: "secret-sensitive-response" }, 400));
    await expect(client().deleteEvent("event")).rejects.toThrow("HTTP 400");
    token(); fetchMock.mockResolvedValueOnce(response({ error: "secret-sensitive-response" }, 503));
    await expect(client().createEvent(input)).rejects.toThrow("HTTP 503");
  });
});
