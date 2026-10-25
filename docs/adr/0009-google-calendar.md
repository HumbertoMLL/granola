# ADR 0009 — Calendar primario, Meet y disponibilidad de Google

**Fecha:** 2026-10-24 · **Estado:** aceptado (tarea Google Calendar sync)

## Decisión

`@granola/google-calendar` es un paquete Node sin Next ni `googleapis`: usa fetch
con timeout, zod en entradas/respuestas y Calendar API v3. Administra el calendario
`primary` de la cuenta conectada; no envía nombres, teléfonos, correos ni notas
clínicas del paciente a Google. Los eventos llevan el título «Consulta Granola».

Better Auth conserva la identidad y obtiene consentimiento OAuth con los scopes
`https://www.googleapis.com/auth/calendar.events` y
`https://www.googleapis.com/auth/calendar.freebusy`, `accessType: offline` y
`prompt: consent`. `linkSocial` permite conectar una sesión iniciada por email;
se conserva la restricción de Better Auth de misma dirección de correo.

Activamos `account.encryptOAuthTokens` para evitar la copia en claro que Better
Auth guardaría por defecto. Sus hooks `account.create/update.after` descifran
solo en memoria y guardan otra copia AES-256-GCM en
`nutritionists.google_refresh_token_enc`, con `GOOGLE_TOKEN_ENC_KEY` independiente
(32 bytes base64; `openssl rand -base64 32`). Envelope `v1:iv:tag:ciphertext`, IV
aleatorio de 12 bytes y AAD de propósito. La llave se lee al usarla, no al importar:
no hace falta para compilar. Rotarla requiere volver a conectar Calendar.
El hook también crea el perfil si es el primer login social. Desconectar elimina
la copia del perfil y access/refresh tokens de la cuenta OAuth del usuario de la
sesión; conserva su identidad Google para login. No revoca el grant en Google.

## Jobs e idempotencia

Calendar se ejecuta en `step.run` **después** del WhatsApp inmediato y antes de
los sleeps o de rearmar recordatorios. Lee las credenciales dentro del paso, sin
serializarlas en los resultados de Inngest. Si no hay token, salta; si Google
falla, loguea solo operación/status y continúa los recordatorios.

- Confirmar crea el evento; online solicita `conferenceDataVersion=1` y Meet.
- El UUID de la cita deriva un ID base32hex estable: un replay o fallo entre
  Google y el commit local reconcilia el mismo evento ante HTTP 409. Si ya hay
  `google_event_id`, no vuelve a crear; consulta de nuevo si falta el Meet online.
- Reagendar hace PATCH de fechas preservando conferencia; si nunca se sincronizó,
  crea. Cancelar elimina (404/410 son éxito idempotente) y limpia id/Meet local.
- Las queries y updates se filtran por cita y `nutritionist_id`; se relee estado
  dentro del paso y no se confirma una respuesta remota sobre fechas ya cambiadas.
- Meet puede tardar en generarse en Google: hay polling acotado del recurso
  mientras esté pending. La UI muestra el link en `/listo` y `/cita/<token>` si ya
  existe; no agrega polling del navegador. Los recordatorios releen `meet_url`.

## Slots y Twelve-Factor

Web y API v1 agregan busy de Google a las citas Granola sin cambiar `core`.
Un helper compartido cachea intervalos durante 60 s **por instancia** (200
entradas máximo, rangos redondeados a días UTC, clave por nutri/rango/conexión).
Deduplica llamadas concurrentes e invalida al sincronizar/desconectar en esa
instancia. Las otras instancias pueden conservar hasta 60 s el resultado previo.
Si Google falla, se calcula con Granola y se loguea, sin PII. No es un bloqueo
distribuido ni garantiza atomicidad contra cambios hechos directamente en Google.

Al reagendar hay que excluir el evento propio. `freeBusy` fusiona intervalos y
no devuelve IDs: en ese caso el cliente usa `events.list` paginado con
`singleEvents=true` y descarta únicamente el ID propio, eventos transparentes,
cancelados, working location y participaciones rechazadas. Incluye días completos
en la zona del calendario. Así no borra accidentalmente otro evento superpuesto.

## Configurar y probar con Google real

1. En Google Cloud Console habilitar **Google Calendar API**.
2. Configurar la pantalla OAuth/Google Auth Platform; agregar los dos scopes
   Calendar anteriores y los usuarios de prueba si la app está en Testing.
3. Crear un OAuth Client ID de tipo **Web application**. Autorizar el origen de
   la app y exactamente `<BETTER_AUTH_URL>/api/auth/callback/google` como redirect
   URI: local `http://localhost:3100/api/auth/callback/google`; producción con su
   dominio HTTPS. Si el worktree usa otro puerto, registrar también ese URI.
4. Configurar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENC_KEY` y
   `BETTER_AUTH_URL` en web y en el proceso de jobs. Iniciar sesión con el mismo
   correo de Google → Configuración → **Conectar Google Calendar** → aceptar los
   permisos y volver al panel.
5. Confirmar una cita online con Inngest dev activo: verificar evento, Meet e IDs
   guardados. Crear otro evento busy en Google y comprobar que desaparece ese
   horario de la reserva (hasta 60 s de TTL). Reagendar/cancelar y verificar
   el cambio remoto. Desconectar y comprobar que la agenda local sigue disponible.

## Validación y límites

Unit tests mockean fetch (refresh, cuatro métodos, Meet pending, replay, errores,
cifrado autenticado y TTL). Integración ejecuta handlers reales con orquestación
Inngest y Google mockeados, pero DB real: crear/persistir, cancelar, mover,
idempotencia, ausencia de token, aislamiento por tenant, OAuth y slots/fallback.
E2E cubre reserva/agenda/cancelación y el link Meet ya persistido en ambas páginas.

No agrega migraciones, selección de calendarios secundarios, importación de
pacientes, webhooks push/watch ni sincronización Google → estado de citas Granola.
Fallos de sincronización se aíslan (no se reintenta indefinidamente ni bloquean
WhatsApp); un nuevo evento o una ejecución desde cero puede recuperar el trabajo. La confirmación
WhatsApp inicial precede al Meet; sus recordatorios sí pueden incluirlo después.
No provisiona credenciales, aprobación OAuth ni conectividad real de una cuenta
Google del operador: las pruebas automatizadas usan Google mockeado.

## Referencias

- [Google: crear eventos y conferenceData](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
- [Google: free/busy](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- [Google: OAuth offline y configuración web](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Better Auth: Google y consentimiento](https://github.com/better-auth/better-auth/blob/main/docs/content/docs/authentication/google.mdx)
