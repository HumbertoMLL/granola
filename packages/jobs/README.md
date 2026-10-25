# @granola/jobs

Funciones Inngest del flujo estrella (PLAN.md §5). Contrato de eventos en `src/events.ts` (no renombrar).

| Función | Evento | Qué hace |
|---|---|---|
| `onAppointmentConfirmed` | `appointment/confirmed` | Calendar + reintentos de Meet → recargar cita → `cita_confirmada` + `nueva_cita_nutri` (si `notify_new_booking`) + correos en steps separados (paciente si tiene email y nutri siempre) → sleep → `recordatorio_24h` → sleep → `recordatorio_2h` → sleep (ends_at+2h) → `completed` + emite `appointment/completed`. `cancelOn` cancelled/rescheduled. Con `isReschedule: true` solo rearma recordatorios. |
| `onAppointmentCancelled` | `appointment/cancelled` | `cita_cancelada` + correo al paciente si tiene email |
| `onAppointmentRescheduled` | `appointment/rescheduled` | `cita_reagendada` + re-emite `appointment/confirmed { isReschedule: true }` |
| `onPendingPayment` | `appointment/pending_payment` | `pago_pendiente_oxxo` → sleepUntil(expiresAt) → si sigue pendiente cancela `by: "system"`. `cancelOn` confirmed/cancelled |
| `onAppointmentCompleted` | `appointment/completed` | `pide_resena` |

Cada función relee la cita (`loadAppointment`) antes de cada envío y hace un `step.run` por mensaje. Errores no reintentables de Meta → `NonRetriableError`.

- Cliente: `src/client.ts` exporta `inngest` (id `granola`). `apps/web/src/lib/inngest-client.ts` debe usar el mismo.
- Servir: `apps/web/src/app/api/inngest/route.ts` con `serve({ client, functions })`.
- Dev local: `npx inngest-cli@latest dev -u http://localhost:3100/api/inngest`.

Los jobs cargan la cita con el nutritionistId del evento validado y obtienen el
correo de la nutri desde su usuario. Los correos pasan por `@granola/email`;
no se persisten en F1 (solo logs de metadatos sin PII). Cada destinatario tiene
su step e Idempotency-Key para reintentos. El webhook de Resend queda pendiente.
Ver [ADR 0010](../../docs/adr/0010-email-resend.md).

Antes de confirmar por WhatsApp/correo, `calendar-confirmed` y hasta tres pasos
`calendar-meet-N` intentan recuperar Meet, con esperas durables de 10 segundos.
`recargar-confirmacion` consulta de nuevo la cita para incluir el enlace persistido;
si se canceló mientras Google respondía, omite las confirmaciones. Un fallo o Meet
que sigue pendiente no impide enviar ni programar recordatorios. Los IDs de los
steps de envío y las claves de idempotencia de correo se conservan.

`nutritionists.notify_new_booking` nace en `true`; Configuración → Notificaciones
permite apagar solo `nueva_cita_nutri` por WhatsApp. El step relee la preferencia
antes de enviarlo, también en reintentos. No afecta los avisos al paciente ni el
correo de la nutri. Ver [ADR 0016](../../docs/adr/0016-confirmacion-y-notificaciones.md).
