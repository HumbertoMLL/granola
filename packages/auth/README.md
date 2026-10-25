# @granola/auth

Better Auth sobre nuestro Postgres (ADR 0001). Login de nutriólogas: email + password, magic link y Google (si hay credenciales).

| Export | Uso |
|---|---|
| `@granola/auth` | `auth` (instancia perezosa), tipos `Session` / `SessionUser`. Solo servidor. |
| `@granola/auth/client` | `authClient`, `signIn`, `signOut`, `useSession` para React. |
| `@granola/auth/cookies` | `getSessionCookie` para `proxy.ts` (no toca la DB). |
| `@granola/auth/next` | `toNextJsHandler` para `app/api/auth/[...all]/route.ts`. |

## Plugins

- `magicLink` — hoy imprime el link en la consola del server (falta Resend).
- `bearer` — permite autenticarse con `Authorization: Bearer <token>` en vez de cookie. Pensado para la app Expo y para `curl` contra la API v1 (`/api/v1/*`, ver ADR 0007).

## Sesión por bearer token (Expo, scripts)

1. Inicia sesión contra Better Auth. La respuesta trae el token en el header **`set-auth-token`** (y lo expone en `Access-Control-Expose-Headers`):

   ```bash
   curl -si http://localhost:3100/api/auth/sign-in/email \
     -H 'Content-Type: application/json' \
     -d '{"email":"karla@granola.demo","password":"granola-demo-2026"}' \
     | grep -i '^set-auth-token'
   # set-auth-token: <token>
   ```

   Pasa lo mismo con cualquier endpoint que cree sesión (magic link verificado, Google callback): el plugin agrega el header cuando la respuesta pone la cookie de sesión.

2. Manda ese token en cada request:

   ```bash
   curl -s http://localhost:3100/api/v1/me -H "Authorization: Bearer <token>"
   ```

3. En Expo guarda el token en `expo-secure-store` (nunca en AsyncStorage) y bórralo en logout (`POST /api/auth/sign-out` con el mismo header).

Notas:

- El token es el valor de la cookie `better-auth.session_token` (firmado con `BETTER_AUTH_SECRET`). Rotar el secret invalida todos los tokens.
- Dura lo mismo que la sesión (30 días, se renueva cada 24 h de uso).
- En el servidor no hay que hacer nada especial: `auth.api.getSession({ headers })` acepta cookie o bearer indistintamente. El middleware `requireSession` de `@granola/api` se apoya en eso.
- Alternativa más integrada para Expo: el plugin `@better-auth/expo` (guarda la cookie en SecureStore). Se evalúa cuando exista `apps/mobile`; el bearer sirve para ambos casos.
