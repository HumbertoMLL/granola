import { bienvenida, magicLink as magicLinkEmail, sendEmail } from "@granola/email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { bearer } from "better-auth/plugins";
import { db, schema } from "@granola/db";
import { GOOGLE_CALENDAR_SCOPES, persistGoogleCalendarAccount } from "./google-calendar";

function createAuth() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    appName: "Granola",
    // BETTER_AUTH_URL y BETTER_AUTH_SECRET se leen solos del entorno.
    database: drizzleAdapter(db, { provider: "pg", schema, usePlural: true }),
    advanced: {
      database: { generateId: "uuid" },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    databaseHooks: {
      user: {
        create: {
          async after(user) {
            // La cuenta ya existe: un fallo de bienvenida no debe romper registro/login.
            try {
              const origin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
              await sendEmail({
                to: user.email,
                ...bienvenida({ name: user.name, appUrl: new URL("/app", origin).toString() }),
                tags: [{ name: "template", value: "bienvenida" }],
                idempotencyKey: `welcome-${user.id}`,
              });
            } catch {
              console.error("[email:welcome-failed]");
            }
          },
        },
      },
      account: {
        create: { after: async (account, ctx) => {
          if (ctx) await persistGoogleCalendarAccount(account, ctx.context.secretConfig);
        } },
        update: { after: async (account, ctx) => {
          if (ctx) await persistGoogleCalendarAccount(account, ctx.context.secretConfig);
        } },
      },
    },
    // Google solo se registra si hay credenciales; así el resto funciona sin ellas.
    socialProviders:
      googleClientId && googleClientSecret
        ? { google: { clientId: googleClientId, clientSecret: googleClientSecret, scope: GOOGLE_CALENDAR_SCOPES, accessType: "offline", prompt: "consent" } }
        : {},
    account: { encryptOAuthTokens: true },
    plugins: [
      // Expo / clientes sin cookies: `Authorization: Bearer <token>` se convierte en
      // cookie de sesión antes de validar, y al iniciar sesión la respuesta trae el
      // token en el header `set-auth-token`. Ver packages/auth/README.md.
      bearer(),
      magicLink({
        expiresIn: 60 * 15,
        storeToken: "hashed",
        async sendMagicLink({ email, url }) {
          await sendEmail({
            to: email,
            ...magicLinkEmail({ url }),
            tags: [{ name: "template", value: "magic_link" }],
          });
        },
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 días
      updateAge: 60 * 60 * 24, // renueva cada 24h de uso
      cookieCache: { enabled: true, maxAge: 60 * 5 },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];
export type SessionUser = Session["user"];

let _auth: Auth | undefined;

/** Instancia única, creada en el primer uso (no toca la DB al importar). */
export function getAuth(): Auth {
  _auth ??= createAuth();
  return _auth;
}

/** Acceso perezoso: `auth.api.getSession(...)`, `auth.handler(req)`, etc. */
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const real = getAuth();
    const value = Reflect.get(real, prop, real) as unknown;
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(real) : value;
  },
  has(_target, prop) {
    return Reflect.has(getAuth(), prop);
  },
});
