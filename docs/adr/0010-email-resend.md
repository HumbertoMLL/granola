# ADR 0010 — Correo transaccional con Resend

**Fecha:** 2026-10-24 · **Estado:** aceptado para este workstream (tarea Resend)

## Contexto

Better Auth solo imprimía magic links en consola. El canal email debe cubrir acceso,
bienvenida y avisos de citas, complementando WhatsApp. No se cambian sus plantillas,
su persistencia ni pagos. Aplican los factores III (config), IV (servicios adjuntos),
XI (logs) y XII (tests/scripts repetibles), además de la minimización de datos.

## Decisión

1. `packages/email` (`@granola/email`) sin Next ni SDK: fetch a Resend, con Zod
   en las fronteras, timeout y errores tipados. `RESEND_API_KEY` y `EMAIL_FROM`
   se leen al enviar, no al importar. Sin key: dry run, log seguro e id null.
   Con key: EMAIL_FROM obligatorio y dominio verificado por el operador.
2. Cinco plantillas puras `{subject, html, text}`, HTML con estilos inline,
   paleta Granola y sin imágenes externas. Escapar texto y validar URLs HTTP(S).
   Las horas se formatean en la zona del paciente o de la nutrióloga, respectivamente.
3. Better Auth manda magic links por ese paquete, conservando expiración, hashing,
   cookies, credenciales y providers. Bienvenida en el hook posterior a crear usuario;
   si falla se loguea sin interrumpir el registro/login. La verificación de email
   **no está habilitada actualmente**, así que no se activa ni se exige en este PR.
   Si se habilita después, debe configurar su callback de envío con @granola/email.
4. Confirmación: después de WhatsApp, steps distintos para paciente (si tiene email)
   y nutrióloga (siempre, desde users vía su perfil). Cancelación: después de WhatsApp,
   correo al paciente si tiene email. Reagendado conserva la semántica previa:
   el evento interno isReschedule no repite confirmaciones, solo rearma recordatorios.
   Los jobs validan UUIDs y filtran por nutritionist_id del evento antes de cargar
   paciente, servicio y correo de la nutri. Un evento de otro tenant no envía nada.
5. Reintentos por Inngest, sin repetir steps ya completados; Idempotency-Key de Resend
   por evento y destinatario (ventana de 24 h). 429, red y 5xx reintentan; otros HTTP
   fallan como no reintentables. La bienvenida es best effort sin reintento durable.
6. **No persistir correos en F1: solo log.** Sin tabla, migración ni inserts en
   wa_messages/audit_log. Logs a stdout con cantidad, id de proveedor y status;
   nunca contenido, destinatarios, asuntos, enlaces de acceso ni credenciales.
7. **Webhook de Resend fuera de este PR.** Pendientes: firma e idempotencia del webhook,
   eventos delivered/bounced/complained, supresión, alertas y política de reenvío de bienvenida.

## Costos y operación

Consultado el **24 oct 2026** en [Resend Pricing](https://resend.com/pricing) y su
[tabla oficial Markdown](https://resend.com/pricing.md): gratis 3,000 correos/mes,
100/día; Pro $20 USD/mes por 50,000, excedente $0.90 por mil. Con 10K citas al mes y
email en todos los pacientes, solo las confirmaciones suman ~20K correos; auth y
cancelaciones se añaden. La cuota diaria gratis puede agotarse antes de la mensual.
[Cuotas oficiales](https://resend.com/docs/knowledge-base/account-quotas-and-limits).

La aceptación de la API no equivale a entrega. Resend conserva su propia información
de envío; “no persistir” describe nuestra DB. El operador debe verificar dominio,
configurar DNS y definir retención/privacidad del proveedor antes de usar datos reales.
No se enviarán notas clínicas, antropometría ni expedientes en estos correos.

## Validación

Vitest: snapshot del texto de las cinco plantillas, escape/URLs/zonas horarias,
dry run sin fetch, payload/config/errores del cliente, magic link y bienvenida.
Integración sobre Postgres real con Resend y steps de Inngest mockeados: cita
confirmada con email llama sendEmail dos veces con sus asuntos esperados;
sin email, reagendado, tenant incorrecto y cancelación tienen cobertura propia.
No se necesita API key ni dominio para CI.

Instrucciones de prueba real y limitaciones en [packages/email/README.md](../../packages/email/README.md).
API: [send email](https://resend.com/docs/api-reference/emails/send-email).

Comprobación local: 213 unitarios, 43 de integración (6 nuevos de email/jobs) y el E2E
existente de reserva → agenda → cancelación en verde. Para evitar el túnel SSH que
ocupa 3100, el E2E local usó una copia temporal de la configuración con puerto 3118
(y sus URLs de auth/app); esa copia no forma parte del PR. Los env de servicios
externos permanecieron vacíos. La entrega a bandejas reales requiere la configuración
operativa descrita arriba y no se afirma probada con estos mocks.
