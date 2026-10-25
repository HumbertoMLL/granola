import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
vi.mock("@granola/auth", () => ({ auth: { api: { getSession } } }));

const findNutritionistByUserId = vi.hoisted(() => vi.fn());
vi.mock("../queries/me", () => ({ findNutritionistByUserId }));

import { requireSession } from "./session";
import { requireNutritionist } from "./tenant";

const COOKIE = "better-auth.session_token=tok.sig";
const BEARER = "Bearer tok.sig";

const fakeSession = {
  user: { id: "u1", email: "karla@granola.demo", name: "Karla", image: null },
  session: { id: "s1", userId: "u1", token: "tok", expiresAt: new Date("2030-01-01") },
};

/**
 * Simula Better Auth: hay sesión si llega la cookie de sesión o un bearer
 * (en la vida real el plugin `bearer()` convierte el header en cookie).
 */
function fakeGetSession({ headers }: { headers: Headers }) {
  const cookie = headers.get("cookie") ?? "";
  const authz = headers.get("authorization") ?? "";
  if (cookie.includes("better-auth.session_token=") || authz.startsWith("Bearer ")) {
    return Promise.resolve(fakeSession);
  }
  return Promise.resolve(null);
}

function buildApp() {
  return new Hono()
    .get("/who", requireSession, (c) => c.json({ userId: c.get("user").id, sessionId: c.get("session").id }))
    .get("/tenant", requireSession, requireNutritionist, (c) => c.json({ nutritionistId: c.get("nutritionist").id }));
}

beforeEach(() => {
  getSession.mockReset();
  getSession.mockImplementation(fakeGetSession);
  findNutritionistByUserId.mockReset();
});

describe("requireSession", () => {
  it("401 con error uniforme si no hay sesión", async () => {
    const res = await buildApp().request("/who");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: { code: "unauthorized", message: expect.any(String) } });
  });

  it("200 con cookie de sesión", async () => {
    const res = await buildApp().request("/who", { headers: { cookie: COOKIE } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "u1", sessionId: "s1" });
    const passed = getSession.mock.calls[0]?.[0] as { headers: Headers };
    expect(passed.headers.get("cookie")).toBe(COOKIE);
  });

  it("200 con Authorization: Bearer (pasa el header crudo a Better Auth)", async () => {
    const res = await buildApp().request("/who", { headers: { authorization: BEARER } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "u1", sessionId: "s1" });
    const passed = getSession.mock.calls[0]?.[0] as { headers: Headers };
    expect(passed.headers.get("authorization")).toBe(BEARER);
  });

  it("401 si Better Auth rechaza el token", async () => {
    getSession.mockResolvedValueOnce(null);
    const res = await buildApp().request("/who", { headers: { authorization: "Bearer invalido" } });
    expect(res.status).toBe(401);
  });
});

describe("requireNutritionist", () => {
  it("401 sin sesión (no busca nutri)", async () => {
    const res = await buildApp().request("/tenant");
    expect(res.status).toBe(401);
    expect(findNutritionistByUserId).not.toHaveBeenCalled();
  });

  it("403 si el usuario no tiene fila en nutritionists", async () => {
    findNutritionistByUserId.mockResolvedValueOnce(null);
    const res = await buildApp().request("/tenant", { headers: { cookie: COOKIE } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "forbidden", message: expect.any(String) } });
    expect(findNutritionistByUserId).toHaveBeenCalledWith("u1");
  });

  it("200 y expone el nutri de la sesión", async () => {
    findNutritionistByUserId.mockResolvedValueOnce({ id: "n1", userId: "u1" });
    const res = await buildApp().request("/tenant", { headers: { authorization: BEARER } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ nutritionistId: "n1" });
  });
});
