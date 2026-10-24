import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { db, schema } from "@granola/db";

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
    // Google solo se registra si hay credenciales; así el resto funciona sin ellas.
    socialProviders:
      googleClientId && googleClientSecret
        ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
        : {},
    plugins: [
      magicLink({
        expiresIn: 60 * 15,
        storeToken: "hashed",
        async sendMagicLink({ email, url }) {
          // TODO(Resend): enviar correo real. Por ahora el link sale en la consola del server.
          console.log(`[granola/auth] Magic link para ${email}:\n${url}`);
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
