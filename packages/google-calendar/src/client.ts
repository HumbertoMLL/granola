import { z } from "zod";
import { decryptRefreshToken } from "./crypto";

const API = "https://www.googleapis.com/calendar/v3";
const dateTime = z.string().datetime({ offset: true });
const eventInput = z.object({
  appointmentId: z.string().uuid(),
  startsAt: dateTime,
  endsAt: dateTime,
  timeZone: z.string().min(1),
  modality: z.enum(["online", "presencial"]),
}).refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), "Intervalo inválido");
export type CalendarEventInput = z.infer<typeof eventInput>;
export type BusyInterval = { startsAt: Date; endsAt: Date };
const eventSchema = z.object({
  id: z.string().min(1),
  hangoutLink: z.string().url().optional(),
  conferenceData: z.object({
    createRequest: z.object({ status: z.object({ statusCode: z.string() }) }).optional(),
    entryPoints: z.array(z.object({ entryPointType: z.string(), uri: z.string() })).optional(),
  }).optional(),
});
export type CalendarEvent = { id: string; meetUrl: string | null };

export class GoogleCalendarError extends Error {
  constructor(public readonly status: number) {
    // Nunca incluir cuerpos de Google: pueden traer tokens, PII o detalles del evento.
    super(`Google Calendar respondió HTTP ${status}`);
  }
}

/** UUID hex usa solo caracteres válidos de base32hex; estable ante replays y carreras. */
export function calendarEventId(appointmentId: string): string {
  return `granola${z.string().uuid().parse(appointmentId).replaceAll("-", "")}`;
}

export class GoogleCalendarClient {
  private token?: { value: string; expiresAt: number };
  constructor(private readonly encryptedRefreshToken: string) {}

  async refreshAccessToken(): Promise<string> {
    const env = z.object({ GOOGLE_CLIENT_ID: z.string().min(1), GOOGLE_CLIENT_SECRET: z.string().min(1) }).parse(process.env);
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: decryptRefreshToken(this.encryptedRefreshToken),
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new GoogleCalendarError(response.status);
    const result = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).parse(await response.json());
    this.token = { value: result.access_token, expiresAt: Date.now() + result.expires_in * 1000 };
    return result.access_token;
  }

  private async request(path: string, method = "GET", body?: unknown): Promise<Response> {
    const token = this.token && this.token.expiresAt > Date.now() + 30_000 ? this.token.value : await this.refreshAccessToken();
    return fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  }

  private payload(input: CalendarEventInput) {
    const parsed = eventInput.parse(input);
    return {
      // Sin nombres, notas clínicas, teléfonos ni correos del paciente en Google.
      summary: "Consulta Granola",
      start: { dateTime: parsed.startsAt, timeZone: parsed.timeZone },
      end: { dateTime: parsed.endsAt, timeZone: parsed.timeZone },
      ...(parsed.modality === "online" ? { conferenceData: { createRequest: {
        requestId: calendarEventId(parsed.appointmentId), conferenceSolutionKey: { type: "hangoutsMeet" },
      } } } : {}),
    };
  }

  private async readEvent(response: Response, waitForMeet = false): Promise<CalendarEvent> {
    if (!response.ok) throw new GoogleCalendarError(response.status);
    let event = eventSchema.parse(await response.json());
    // Meet se crea de forma asíncrona. Espera acotada; un replay puede volver a consultar.
    for (let attempt = 0; waitForMeet && event.conferenceData?.createRequest?.status.statusCode === "pending" && attempt < 5; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const poll = await this.request(`/calendars/primary/events/${encodeURIComponent(event.id)}`);
      if (!poll.ok) throw new GoogleCalendarError(poll.status);
      event = eventSchema.parse(await poll.json());
    }
    const link = event.hangoutLink ?? event.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri;
    const meetUrl = link && new URL(link).protocol === "https:" ? link : null;
    return { id: event.id, meetUrl };
  }

  async createEvent(input: CalendarEventInput): Promise<CalendarEvent> {
    const id = calendarEventId(input.appointmentId);
    const result = await this.request("/calendars/primary/events?conferenceDataVersion=1", "POST", { ...this.payload(input), id });
    // Si Google confirmó el insert pero falló la persistencia local, recuperar el mismo evento.
    if (result.status === 409) return this.updateEvent(id, input);
    return this.readEvent(result, input.modality === "online");
  }

  async updateEvent(id: string, input: CalendarEventInput): Promise<CalendarEvent> {
    const { conferenceData: _conferenceData, ...payload } = this.payload(input);
    // PATCH preserva el Meet existente; no se solicita una conferencia nueva al moverlo.
    const result = await this.request(`/calendars/primary/events/${encodeURIComponent(z.string().min(1).parse(id))}?conferenceDataVersion=1`, "PATCH", payload);
    return this.readEvent(result, input.modality === "online");
  }

  async deleteEvent(id: string): Promise<void> {
    const result = await this.request(`/calendars/primary/events/${encodeURIComponent(z.string().min(1).parse(id))}`, "DELETE");
    if (!result.ok && result.status !== 404 && result.status !== 410) throw new GoogleCalendarError(result.status);
  }

  async freeBusy(timeMin: string, timeMax: string, excludeEventId?: string): Promise<BusyInterval[]> {
    dateTime.parse(timeMin); dateTime.parse(timeMax);
    if (Date.parse(timeMin) >= Date.parse(timeMax)) throw new Error("Intervalo inválido");
    // freeBusy fusiona intervalos y pierde los IDs. Al reagendar hay que listar los
    // eventos, no restar el rango propio: podría ocultar otro evento que lo encime.
    if (excludeEventId) return this.busyExceptEvent(timeMin, timeMax, excludeEventId);
    const result = await this.request("/freeBusy", "POST", { timeMin, timeMax, items: [{ id: "primary" }] });
    if (!result.ok) throw new GoogleCalendarError(result.status);
    const parsed = z.object({ calendars: z.record(z.string(), z.object({
      errors: z.array(z.unknown()).optional(), busy: z.array(z.object({ start: dateTime, end: dateTime })).optional(),
    })) }).parse(await result.json());
    return Object.values(parsed.calendars).flatMap((calendar) => {
      if (calendar.errors?.length) throw new GoogleCalendarError(502);
      return (calendar.busy ?? []).map((v) => ({ startsAt: new Date(v.start), endsAt: new Date(v.end) }));
    });
  }

  private async busyExceptEvent(timeMin: string, timeMax: string, excluded: string): Promise<BusyInterval[]> {
    const point = z.object({ dateTime: dateTime.optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), timeZone: z.string().optional() });
    const schema = z.object({ timeZone: z.string().default("UTC"), nextPageToken: z.string().optional(), items: z.array(z.object({
      id: z.string(), status: z.string().optional(), transparency: z.string().optional(), eventType: z.string().optional(),
      start: point.optional(), end: point.optional(),
      attendees: z.array(z.object({ self: z.boolean().optional(), responseStatus: z.string().optional() })).optional(),
    })).default([]) });
    const busy: BusyInterval[] = [];
    let page: string | undefined;
    do {
      const query = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", maxResults: "2500", ...(page ? { pageToken: page } : {}) });
      const result = await this.request(`/calendars/primary/events?${query}`);
      if (!result.ok) throw new GoogleCalendarError(result.status);
      const data = schema.parse(await result.json());
      for (const event of data.items) {
        if (event.id === excluded || event.status === "cancelled" || event.transparency === "transparent" || event.eventType === "workingLocation" || event.attendees?.some((a) => a.self && a.responseStatus === "declined")) continue;
        if (!event.start || !event.end) throw new GoogleCalendarError(502);
        const startsAt = event.start.dateTime ? new Date(event.start.dateTime) : localMidnight(z.string().parse(event.start.date), event.start.timeZone ?? data.timeZone);
        const endsAt = event.end.dateTime ? new Date(event.end.dateTime) : localMidnight(z.string().parse(event.end.date), event.end.timeZone ?? data.timeZone);
        busy.push({ startsAt, endsAt });
      }
      page = data.nextPageToken;
    } while (page);
    return busy;
  }
}

function localMidnight(date: string, timeZone: string): Date {
  const target = Date.parse(`${date}T00:00:00Z`);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
    const wall = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    instant += target - wall;
  }
  return new Date(instant);
}

export function createGoogleCalendarClient(encryptedRefreshToken: string): GoogleCalendarClient {
  return new GoogleCalendarClient(encryptedRefreshToken);
}
