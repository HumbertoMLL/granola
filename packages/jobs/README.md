# @granola/jobs

Funciones Inngest del flujo estrella (PLAN.md §5). Contrato de eventos en `src/events.ts` (no renombrar).

| Función | Evento | Qué hace |
|---|---|---|
| `onAppointmentConfirmed` | `appointment/confirmed` | `cita_confirmada` + `nueva_cita_nutri` → sleep → `recordatorio_24h` → sleep → `recordatorio_2h` → sleep (ends_at+2h) → `completed` + emite `appointment/completed`. `cancelOn` cancelled/rescheduled. Con `isReschedule: true` solo rearma recordatorios. |
| `onAppointmentCancelled` | `appointment/cancelled` | `cita_cancelada` |
| `onAppointmentRescheduled` | `appointment/rescheduled` | `cita_reagendada` + re-emite `appointment/confirmed { isReschedule: true }` |
| `onPendingPayment` | `appointment/pending_payment` | `pago_pendiente_oxxo` → sleepUntil(expiresAt) → si sigue pendiente cancela `by: "system"`. `cancelOn` confirmed/cancelled |
| `onAppointmentCompleted` | `appointment/completed` | `pide_resena` |

Cada función relee la cita (`loadAppointment`) antes de cada envío y hace un `step.run` por mensaje. Errores no reintentables de Meta → `NonRetriableError`.

- Cliente: `src/client.ts` exporta `inngest` (id `granola`). `apps/web/src/lib/inngest-client.ts` debe usar el mismo.
- Servir: `apps/web/src/app/api/inngest/route.ts` con `serve({ client, functions })`.
- Dev local: `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`.
