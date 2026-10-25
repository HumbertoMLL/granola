# ADR 0016: Confirmaciones con Meet y preferencia de avisos a la nutri

- Estado: aceptado
- Fecha: 2026-10-25
- Complementa ADR 0009 (orden de Calendar) y ADR 0010 (correo transaccional).

## Contexto

El snapshot inicial de `appointment/confirmed` precedía la creación del evento de
Calendar. Aunque Google devolviera Meet, el correo y WhatsApp ya habían salido sin
el enlace. Configuración tampoco tenía una preferencia persistida para el aviso
de nueva cita a la nutrióloga.

## Decisión

1. Ejecutar `calendar-confirmed` y, si Meet sigue pendiente, hasta tres pasos
   `calendar-meet-N` con esperas Inngest de 10 segundos antes de las confirmaciones.
2. Recargar con `loadAppointment(appointmentId, nutritionistId)` en un step propio.
   Usar ese snapshot en WhatsApp y correo para incluir `meet_url`. Si la cita ya
   no está confirmada, no enviar. Si Google falla o agota los intentos, continuar
   sin enlace; los recordatorios vuelven a consultar los datos actuales.
3. Conservar los IDs de steps de envío y las claves de idempotencia de correo:
   un reintento no vuelve a crear el evento ni repite steps ya completados. Un run
   que ya había enviado una confirmación con la versión anterior no puede corregir
   retroactivamente ese mensaje; los recordatorios sí recuperan el enlace.
4. Agregar `nutritionists.notify_new_booking boolean not null default true` con
   migración expand. Las filas existentes siguen recibiendo avisos y el código
   anterior tolera la columna nueva. La migración debe aplicar antes de promover
   el código que la lee, mediante el flujo de release del ADR 0012.
5. Un switch en Configuración → Notificaciones cambia solo el perfil de la sesión.
   El step `wa-nueva-cita-nutri` relee la preferencia antes del envío. `false` omite
   ese WhatsApp; mantiene los mensajes al paciente y los correos.

## Consecuencias y verificación

La confirmación puede esperar hasta 30 segundos adicionales por Meet, además de
las peticiones a Google. La espera es durable, acotada y no exige conexión a Google
para el resto del flujo (factores IV y IX). Preferencias y enlaces viven en Postgres,
no en memoria (VI); tokens y datos del paciente no se agregan a logs (III y XI).

Integración contra Postgres cubre Meet inmediato y pendiente, agotamiento de intentos,
fallo/cancelación durante Calendar, preferencia apagada, persistencia, validación y
aislamiento entre nutriólogas. No se cambia el contrato de eventos ni se generan
plantillas nuevas de WhatsApp.
