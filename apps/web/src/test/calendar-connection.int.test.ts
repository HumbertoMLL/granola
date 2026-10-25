import { generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { symmetricEncrypt } from "better-auth/crypto";
import { accounts, db, eq, nutritionists, users } from "@granola/db";
import { seedNutritionist } from "@granola/db/testing";
import { decryptRefreshToken } from "@granola/google-calendar/crypto";
import { getAuth } from "@granola/auth";
import { GOOGLE_CALENDAR_SCOPES, persistGoogleCalendarAccount } from "../../../../packages/auth/src/google-calendar";
import { disconnectGoogleCalendar } from "@/app/(panel)/app/configuracion/calendar-actions";
import type { NutritionistSession } from "@/lib/session";

const session = vi.hoisted(() => ({ value: null as NutritionistSession | null }));
vi.mock("@/lib/session", () => ({ requireNutritionist: async () => {
  if (!session.value) throw new Error("unauthorized"); return session.value;
} }));
const secret = "test-secret-granola-no-usar-en-produccion-0123456789";
beforeEach(() => {
  session.value = null;
  vi.stubEnv("GOOGLE_TOKEN_ENC_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-client-secret");
});

describe("Cuando una nutrióloga conecta Google Calendar", () => {
  it("Better Auth pide scopes Calendar, offline y consent y cifra sus tokens OAuth", async () => {
    const auth = getAuth();
    expect(auth.options.account?.encryptOAuthTokens).toBe(true);
    const response = await auth.api.signInSocial({ body: { provider: "google", callbackURL: "http://localhost:3100/app/configuracion" } });
    const url = new URL(response.url!);
    expect(url.searchParams.get("access_type")).toBe("offline"); expect(url.searchParams.get("prompt")).toBe("consent");
    for (const scope of GOOGLE_CALENDAR_SCOPES) expect(url.searchParams.get("scope")).toContain(scope);
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3100/api/auth/callback/google");
  });
  it("completa linkSocial desde una sesión email y el callback persiste ambos tokens cifrados", async () => {
    const auth = getAuth();
    const origin = "http://localhost:3100";
    const request = (path: string, body: unknown, cookie = "") => new Request(`${origin}/api/auth/${path}`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie }, body: JSON.stringify(body),
    });
    const cookies = (response: Response) => response.headers.getSetCookie().map((v) => v.split(";")[0]).join("; ");
    const signup = await auth.handler(request("sign-up/email", { name: "Nutri OAuth", email: "oauth@granola.test", password: "test-password-2026" }));
    expect(signup.status).toBe(200);
    const loginCookie = cookies(signup);
    const link = await auth.handler(request("link-social", { provider: "google", callbackURL: `${origin}/app/configuracion` }, loginCookie));
    expect(link.status).toBe(200);
    const { url } = await link.json() as { url: string };
    const google = new URL(url);
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const now = Math.floor(Date.now() / 1000);
    const payload = { sub: "google-user-123", aud: "test-client", iss: "https://accounts.google.com", iat: now, exp: now + 3600, nonce: google.searchParams.get("nonce"), email: "oauth@granola.test", email_verified: true, name: "Nutri OAuth" };
    const unsigned = [Buffer.from(JSON.stringify({ alg: "RS256", kid: "calendar-test" })).toString("base64url"), Buffer.from(JSON.stringify(payload)).toString("base64url")].join(".");
    const idToken = `${unsigned}.${sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url")}`;
    const actualFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const target = input instanceof Request ? input.url : String(input);
      if (target === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "google-access", refresh_token: "google-refresh", id_token: idToken, expires_in: 3600, token_type: "Bearer", scope: GOOGLE_CALENDAR_SCOPES.join(" ") });
      if (target === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "calendar-test", alg: "RS256", use: "sig" }] });
      return actualFetch(input, init);
    });
    const callback = new URL(google.searchParams.get("redirect_uri")!);
    callback.searchParams.set("code", "test-code"); callback.searchParams.set("state", google.searchParams.get("state")!);
    const result = await auth.handler(new Request(callback, { headers: { Cookie: `${loginCookie}; ${cookies(link)}` } }));
    expect(result.headers.get("location")).toBe(`${origin}/app/configuracion`);
    const user = await db.query.users.findFirst({ where: eq(users.email, "oauth@granola.test") });
    const account = await db.query.accounts.findFirst({ where: eq(accounts.providerId, "google") });
    expect(account?.userId).toBe(user!.id);
    expect(account?.refreshToken).toBeTruthy(); expect(account!.refreshToken).not.toBe("google-refresh");
    const profile = await db.query.nutritionists.findFirst({ where: eq(nutritionists.userId, user!.id) });
    expect(decryptRefreshToken(profile!.googleRefreshTokenEnc!)).toBe("google-refresh");
  });

  it("el hook crea el perfil del primer login social con refresh token cifrado", async () => {
    const [user] = await db.insert(users).values({ name: "Nutri Google", email: "google@granola.test", emailVerified: true, image: "https://example.com/avatar.png" }).returning();
    const token = await symmetricEncrypt({ key: secret, data: "google-refresh-secret" });
    await persistGoogleCalendarAccount({ providerId: "google", userId: user!.id, refreshToken: token, scope: GOOGLE_CALENDAR_SCOPES.join(" ") }, secret);
    const profile = await db.query.nutritionists.findFirst({ where: eq(nutritionists.userId, user!.id) });
    expect(profile?.avatarUrl).toBe("https://example.com/avatar.png");
    expect(profile?.googleRefreshTokenEnc).not.toContain("google-refresh-secret");
    expect(decryptRefreshToken(profile!.googleRefreshTokenEnc!)).toBe("google-refresh-secret");
    await persistGoogleCalendarAccount({ providerId: "google", userId: user!.id, refreshToken: null }, secret);
    expect((await db.query.nutritionists.findFirst({ where: eq(nutritionists.userId, user!.id) }))?.googleRefreshTokenEnc).toBe(profile!.googleRefreshTokenEnc);
  });
  it("desconecta solo el tenant de la sesión y borra ambas copias del token", async () => {
    const own = await seedNutritionist({ googleRefreshTokenEnc: "own-encrypted" });
    const other = await seedNutritionist({ googleRefreshTokenEnc: "other-encrypted" }); session.value = own;
    await db.insert(accounts).values({ providerId: "google", accountId: "google-id", userId: own.user.id, refreshToken: "own-encrypted", accessToken: "access-encrypted" });
    await disconnectGoogleCalendar();
    expect((await db.query.nutritionists.findFirst({ where: eq(nutritionists.id, own.nutritionist.id) }))?.googleRefreshTokenEnc).toBeNull();
    expect((await db.query.nutritionists.findFirst({ where: eq(nutritionists.id, other.nutritionist.id) }))?.googleRefreshTokenEnc).toBe("other-encrypted");
    expect(await db.query.accounts.findFirst({ where: eq(accounts.userId, own.user.id) })).toMatchObject({ refreshToken: null, accessToken: null });
  });
  it("sin sesión rechaza la desconexión", async () => {
    await expect(disconnectGoogleCalendar()).rejects.toThrow("unauthorized");
  });
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
