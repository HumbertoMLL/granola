# @granola/email

Correo transaccional de Granola, sin Next ni SDK. `sendEmail` usa fetch directamente
contra `https://api.resend.com/emails`. Las plantillas puras exportadas desde
`@granola/email/templates` devuelven `{ subject, html, text }` y no leen env ni hacen IO.

```ts
import { magicLink, sendEmail } from "@granola/email";
await sendEmail({
  to: "destinatario@example.test",
  ...magicLink({ url: "https://granola.app/api/auth/magic-link/verify?token=ejemplo" }),
  tags: [{ name: "template", value: "magic_link" }],
});
```

## Configuración

- `RESEND_API_KEY`: sin valor se hace dry run, sin fetch, devolviendo `{ id: null, dryRun: true }`.
- `EMAIL_FROM`: con API key es obligatorio; por ejemplo `Granola <hola@granola.app>`.
  El dominio de ese remitente debe estar verificado en Resend.
- `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL`: los consumidores construyen los enlaces
  con el origen configurado (fallback local `http://localhost:3000`). Las plantillas
  reciben URLs completas; nunca deciden el entorno.

La configuración se lee al enviar. Importar el paquete y compilar no requiere secretos.
`createEmailClient({ fetch, logger })` permite inyectar fronteras en pruebas.
Entrada, remitente y respuesta se validan con Zod; solo se aceptan links HTTP(S) y
el contenido dinámico se escapa en HTML. Hay timeout de 15 segundos.

## Reintentos y logs

Un error de transporte, HTTP 429 o 5xx lanza `EmailApiError` reintentable. Otros HTTP
se consideran permanentes en los jobs. Inngest controla los reintentos: un step por
destinatario, después de los steps de WhatsApp. Se omite al paciente sin email;
la nutrióloga recibe siempre la confirmación usando el email de su usuario.
Los eventos de reagendado solo rearman los recordatorios y no repiten confirmaciones.

`idempotencyKey` es opcional; los jobs lo derivan de evento y destinatario, y la
bienvenida del usuario creado. Resend deduplica durante 24 horas; después se depende
del registro de steps de Inngest. Esto no garantiza exactamente una entrega ante
un replay manual pasado ese plazo.

Se loguean evento (`email:dry-run`, `email:sent`, `email:failed`), cantidad de
receptores, id de proveedor o status HTTP. Nunca destinatarios, asuntos, cuerpos,
tokens, URLs, API key ni respuestas crudas. No se persisten correos en nuestra DB
ni en audit_log/wa_messages. El webhook de Resend queda para otro PR.
La bienvenida fallida se loguea y no impide registrar/iniciar sesión; su reenvío
queda pendiente. Magic link propaga el error de envío para no fingir éxito real.

## Cómo probar

```sh
pnpm --filter @granola/email test
pnpm --filter @granola/auth test
docker-compose -p granola -f docker-compose.local.yml up -d
pnpm test:integration
```

La integración usa fixtures de Postgres en granola_test, Resend mockeado y la
frontera de steps de Inngest simulada; ejecuta los callbacks reales de los jobs.
Verifica dos llamadas sendEmail con sus asuntos, omisión si no hay email,
reagendado, aislamiento por tenant y cancelación. No manda correos reales.

Para probar recepción real:

1. Agregar un dominio que controles en Resend y completar los registros DNS que
   indique su panel hasta que aparezca verificado. Mantener tracking de enlaces
   desactivado para emails de acceso. [Guía oficial](https://resend.com/docs/dashboard/domains/introduction).
2. Configurar `RESEND_API_KEY` y `EMAIL_FROM` en el entorno de ejecución, y las URLs
   públicas con el origen correcto. No versionar secretos ni usar .env.local en tests.
3. En un entorno de prueba, solicitar magic link a una dirección propia. Abrir el
   correo, comprobar texto y enlace, y entrar. Registrar otra cuenta propia para
   comprobar bienvenida. La verificación de email no se habilita en este PR.
4. Con Inngest local activo, confirmar una cita de prueba con email propio de paciente
   y de la nutri: deben llegar dos correos además de WhatsApp. Cancelar otra cita
   y comprobar correo al paciente. Sin email del paciente, solo debe llegar a la nutri.
5. Consultar los logs de Resend para diferenciar aceptación de entrega; un id de API
   confirma aceptación por el proveedor, no recepción en bandeja de entrada.

No es necesario verificar un dominio ni configurar API key para tests o build.
