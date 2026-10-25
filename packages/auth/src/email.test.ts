import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins/magic-link";
import { sendEmail } from "@granola/email";
import { getAuth } from "./index";

vi.mock("better-auth", () => ({ betterAuth: vi.fn(() => ({})) }));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: vi.fn(() => ({})) }));
vi.mock("better-auth/plugins", () => ({ bearer: vi.fn(() => ({ id: "bearer" })) }));
vi.mock("better-auth/plugins/magic-link", () => ({ magicLink: vi.fn(() => ({ id: "magic-link" })) }));
vi.mock("@granola/db", () => ({ db: {}, schema: {} }));
vi.mock("@granola/email", async (importOriginal) => ({
  ...await importOriginal<typeof import("@granola/email")>(),
  sendEmail: vi.fn(async () => ({ id: "resend-mocked", dryRun: false })),
}));
const user = { id: "user-demo", name: "Karla", email: "karla@example.test", emailVerified: false, createdAt: new Date(), updatedAt: new Date() };
let authOptions: Parameters<typeof betterAuth>[0] | undefined;
let linkOptions: Parameters<typeof magicLink>[0] | undefined;
beforeAll(() => {
  getAuth();
  authOptions = vi.mocked(betterAuth).mock.calls[0]?.[0];
  linkOptions = vi.mocked(magicLink).mock.calls[0]?.[0];
});
beforeEach(() => { vi.mocked(sendEmail).mockClear(); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://granola.app"); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function welcomeHook() {
  const hook = authOptions?.databaseHooks?.user?.create?.after;
  if (!hook) throw new Error("Falta hook de bienvenida");
  return hook;
}
function magicLinkOptions() {
  const options = linkOptions;
  if (!options) throw new Error("Falta plugin magicLink");
  return options;
}

describe("correos de Better Auth", () => {
  it("el magic link se envía por @granola/email con la URL que entrega Better Auth", async () => {
    const url = "https://granola.app/api/auth/magic-link/verify?token=prueba";
    await magicLinkOptions().sendMagicLink({ email: user.email, url, token: "prueba" });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: user.email, subject: "Tu enlace para entrar a Granola", text: expect.stringContaining(url) }));
  });
  it("no cambia expiración, almacenamiento de token, login por contraseña ni verificación", () => {
    expect(magicLinkOptions()).toMatchObject({ expiresIn: 900, storeToken: "hashed" });
    const options = authOptions;
    expect(options?.emailAndPassword).toEqual({ enabled: true, minPasswordLength: 8 });
    expect(options?.emailVerification).toBeUndefined();
  });
  it("manda bienvenida después de crear el usuario", async () => {
    await welcomeHook()(user, null);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: user.email, subject: "Te damos la bienvenida a Granola", text: expect.stringContaining("https://granola.app/app"), idempotencyKey: "welcome-user-demo" }));
  });
  it("un fallo de bienvenida no rompe la creación de cuenta ni filtra PII", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("respuesta privada de Resend"));
    await expect(welcomeHook()(user, null)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith("[email:welcome-failed]");
    expect(JSON.stringify(log.mock.calls)).not.toContain(user.email);
  });
});
