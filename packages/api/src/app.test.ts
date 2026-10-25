import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// DB y auth mockeadas: no hay helper de DB de test en el repo (ver ADR 0007).
const getSession = vi.hoisted(() => vi.fn());
vi.mock("@granola/auth", () => ({ auth: { api: { getSession } } }));

const pub = vi.hoisted(() => ({
  getPublicNutritionistBySlug: vi.fn(),
  getActiveServices: vi.fn(),
  getActiveService: vi.fn(),
  loadSchedulingContext: vi.fn(),
}));
vi.mock("./queries/public", () => pub);

const me = vi.hoisted(() => ({ findNutritionistByUserId: vi.fn(), listAppointments: vi.fn() }));
vi.mock("./queries/me", () => me);

import { app } from "./app";
import { getDefaultRateLimiter } from "./rate-limit";

const NUTRI = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "karla",
  displayName: "Karla Nutrióloga",
  bio: "Nutrición deportiva",
  avatarUrl: null,
  timezone: "America/Mexico_City",
  bufferMin: 0,
  minNoticeMin: 120,
  slotStepMin: 30,
};
const SERVICE = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Primera consulta",
  description: null,
  durationMin: 60,
  priceCents: 80000,
  currency: "MXN",
  modality: "online" as const,
  location: null,
  paymentMode: "at_visit" as const,
};

const get = (path: string, headers?: Record<string, string>) => app.request(`/api/v1${path}`, { headers });

beforeEach(() => {
  getDefaultRateLimiter().reset();
  vi.clearAllMocks();
  getSession.mockResolvedValue(null);
  pub.getPublicNutritionistBySlug.mockImplementation(async (slug: string) => (slug === "karla" ? NUTRI : null));
  pub.getActiveServices.mockResolvedValue([SERVICE]);
  pub.getActiveService.mockImplementation(async (_n: string, id: string) => (id === SERVICE.id ? SERVICE : null));
  pub.loadSchedulingContext.mockResolvedValue({ rules: [], overrides: [], busy: [] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /health", () => {
  it("200 sin tocar DB ni sesión", async () => {
    const res = await get("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, version: "v1" });
    expect(getSession).not.toHaveBeenCalled();
  });
});

describe("errores uniformes", () => {
  it("404 JSON en rutas desconocidas", async () => {
    const res = await get("/no-existe");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "Ruta no encontrada" } });
  });

  it("500 JSON sin filtrar el error interno", async () => {
    pub.getPublicNutritionistBySlug.mockRejectedValueOnce(new Error("connection refused 10.0.0.5"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await get("/public/karla");
    spy.mockRestore();
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("10.0.0.5");
  });
});

describe("GET /public/:slug", () => {
  it("devuelve solo campos públicos + servicios activos", async () => {
    const res = await get("/public/Karla");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { nutritionist: Record<string, unknown>; services: unknown[] };
    expect(body.nutritionist).toEqual({
      slug: "karla",
      displayName: "Karla Nutrióloga",
      bio: "Nutrición deportiva",
      avatarUrl: null,
      timezone: "America/Mexico_City",
    });
    expect(body.nutritionist).not.toHaveProperty("id");
    expect(body.services).toEqual([SERVICE]);
    expect(pub.getPublicNutritionistBySlug).toHaveBeenCalledWith("karla");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage");
  });

  it("404 si el slug no existe", async () => {
    const res = await get("/public/nadie");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "Página no encontrada" } });
  });

  it("400 validation_error con slug inválido (sin ir a la DB)", async () => {
    const res = await get("/public/a_b");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("validation_error");
    expect(pub.getPublicNutritionistBySlug).not.toHaveBeenCalled();
  });

  it("429 al pasar 60 requests/min por IP", async () => {
    const h = { "x-forwarded-for": "203.0.113.7" };
    for (let i = 0; i < 60; i++) expect((await get("/public/karla", h)).status).toBe(200);
    const res = await get("/public/karla", h);
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("rate_limited");
    // Otra IP sigue pasando.
    expect((await get("/public/karla", { "x-forwarded-for": "203.0.113.8" })).status).toBe(200);
  });
});

describe("GET /public/:slug/slots", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Lunes 2 nov 2026, 06:00 en CDMX (UTC-6, sin horario de verano).
    vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
  });

  it("calcula slots con @granola/core/scheduling (reglas − citas)", async () => {
    pub.loadSchedulingContext.mockResolvedValue({
      rules: [{ weekday: 2, startTime: "09:00", endTime: "17:00" }], // martes
      overrides: [],
      busy: [{ startsAt: new Date("2026-11-03T16:00:00Z"), endsAt: new Date("2026-11-03T17:00:00Z") }],
    });
    const from = encodeURIComponent("2026-11-03T00:00:00-06:00");
    const to = encodeURIComponent("2026-11-04T00:00:00-06:00");
    const res = await get(`/public/karla/slots?serviceId=${SERVICE.id}&from=${from}&to=${to}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { timezone: string; slots: { startsAt: string; endsAt: string }[] };
    expect(body.timezone).toBe("America/Mexico_City");
    expect(body.slots[0]).toEqual({ startsAt: "2026-11-03T15:00:00.000Z", endsAt: "2026-11-03T16:00:00.000Z" });
    expect(body.slots.at(-1)?.endsAt).toBe("2026-11-03T23:00:00.000Z");
    // Ningún slot se encima con la cita de 10:00–11:00 local.
    const busyStart = Date.parse("2026-11-03T16:00:00Z");
    const busyEnd = Date.parse("2026-11-03T17:00:00Z");
    for (const s of body.slots) {
      expect(Date.parse(s.startsAt) < busyEnd && Date.parse(s.endsAt) > busyStart).toBe(false);
    }
    expect(pub.getActiveService).toHaveBeenCalledWith(NUTRI.id, SERVICE.id);
  });

  it("recorta el rango al horizonte de 28 días", async () => {
    const res = await get(`/public/karla/slots?serviceId=${SERVICE.id}&to=2027-06-01T00:00:00Z`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { from: string; to: string };
    expect(body.from).toBe("2026-11-02T12:00:00.000Z");
    expect(body.to).toBe("2026-11-30T12:00:00.000Z");
  });

  it("400 sin serviceId o con fechas inválidas", async () => {
    expect((await get("/public/karla/slots")).status).toBe(400);
    expect((await get(`/public/karla/slots?serviceId=${SERVICE.id}&from=mañana`)).status).toBe(400);
  });

  it("400 si to <= from", async () => {
    const res = await get(
      `/public/karla/slots?serviceId=${SERVICE.id}&from=2026-11-10T00:00:00Z&to=2026-11-05T00:00:00Z`,
    );
    expect(res.status).toBe(400);
  });

  it("404 si el servicio no es del nutri o está inactivo", async () => {
    const res = await get("/public/karla/slots?serviceId=33333333-3333-4333-8333-333333333333");
    expect(res.status).toBe(404);
    expect(pub.loadSchedulingContext).not.toHaveBeenCalled();
  });
});

describe("GET /me", () => {
  const session = {
    user: { id: "u1", email: "karla@granola.demo", name: "Karla", image: null },
    session: { id: "s1" },
  };
  const fullNutri = {
    ...NUTRI,
    userId: "u1",
    cedula: "123",
    phoneWa: "+5215555555555",
    plan: "trial",
    onboardingStep: 2,
    stripeChargesEnabled: false,
    stripeAccountId: "acct_secret",
    googleRefreshTokenEnc: "enc:secret",
    mpUserId: "mp_1",
  };

  it("401 sin sesión", async () => {
    const res = await get("/me");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "unauthorized", message: expect.any(String) } });
  });

  it("200 con bearer: user + nutri sin secretos", async () => {
    getSession.mockResolvedValue(session);
    me.findNutritionistByUserId.mockResolvedValue(fullNutri);
    const res = await get("/me", { authorization: "Bearer tok.sig" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { user: unknown; nutritionist: Record<string, unknown> };
    expect(body.user).toEqual({ id: "u1", email: "karla@granola.demo", name: "Karla", image: null });
    expect(body.nutritionist).toMatchObject({ id: NUTRI.id, slug: "karla", phoneWa: "+5215555555555" });
    expect(body.nutritionist).not.toHaveProperty("googleRefreshTokenEnc");
    expect(body.nutritionist).not.toHaveProperty("stripeAccountId");
  });

  it("/me/appointments filtra por el nutri de la sesión y valida el rango", async () => {
    getSession.mockResolvedValue(session);
    me.findNutritionistByUserId.mockResolvedValue(fullNutri);
    me.listAppointments.mockResolvedValue([
      {
        id: "a1",
        startsAt: new Date("2026-11-03T16:00:00Z"),
        endsAt: new Date("2026-11-03T17:00:00Z"),
        status: "confirmed",
        modality: "online",
        meetUrl: null,
        notes: null,
        patient: { id: "p1", name: "Ana" },
        service: { id: SERVICE.id, name: SERVICE.name, durationMin: 60 },
      },
    ]);

    const ok = await get("/me/appointments?from=2026-11-01T00:00:00Z&to=2026-11-08T00:00:00Z", { cookie: "x=y" });
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { appointments: { id: string; startsAt: string }[] };
    expect(body.appointments[0]).toMatchObject({ id: "a1", startsAt: "2026-11-03T16:00:00.000Z" });
    expect(me.listAppointments).toHaveBeenCalledWith(
      NUTRI.id,
      new Date("2026-11-01T00:00:00Z"),
      new Date("2026-11-08T00:00:00Z"),
    );

    const tooWide = await get("/me/appointments?from=2026-01-01T00:00:00Z&to=2026-12-31T00:00:00Z", { cookie: "x=y" });
    expect(tooWide.status).toBe(400);
    const inverted = await get("/me/appointments?from=2026-11-08T00:00:00Z&to=2026-11-01T00:00:00Z", { cookie: "x=y" });
    expect(inverted.status).toBe(400);
  });
});
