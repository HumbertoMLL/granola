# ADR 0015 — Borrado lógico de cuenta con 30 días de gracia

**Fecha:** 2026-10-25 · **Estado:** aceptado (decisión de producto de Beto, 25 oct 2026)

## Contexto

- El primer intento (PR #3) borraba la cuenta con `DELETE` en cascada: perfil, pacientes, citas, pagos, mensajes. Eso choca con obligaciones legales:
  - **NOM-004-SSA3-2012**: el expediente clínico se conserva al menos **5 años** desde el último acto médico.
  - **SAT** (CFF art. 30): la contabilidad y sus comprobantes (pagos) se conservan 5 años.
  - **LFPDPPP**: el titular puede pedir cancelación de sus datos, pero el responsable puede bloquearlos durante el plazo de conservación legal en lugar de suprimirlos.
- Un borrado inmediato tampoco perdona errores: una nutri que se equivoca pierde todo sin vuelta atrás.

## Decisión

1. **Nunca hard delete en cascada.** Pedir el borrado marca `nutritionists.deleted_at = now()`, `nutritionists.deletion_scheduled_for = now() + 30 días` y `users.deleted_at` (migración `0004_account_soft_delete`).
2. **Re-pedir contraseña** + escribir `ELIMINAR`. La contraseña se verifica con el hasher de Better Auth (`verifyPassword` de `better-auth/crypto`) contra `accounts.password` del proveedor `credential` (`@granola/auth/password`). Elegimos esto sobre `auth.api.verifyPassword` porque no depende de la cookie ni del cookie cache (5 min) y se prueba con datos reales en integración. Las cuentas sin contraseña (solo Google / magic link) no pueden autoeliminarse todavía (ver Pendientes).
3. **Al pedirlo**, en una transacción (`db.batch`): marca fechas, cancela las citas futuras (`confirmed` y `pending_payment`), revoca **todas** las sesiones (`DELETE FROM sessions`) y registra `account.delete_requested` en `audit_log` con IP. Después emite `appointment/cancelled` con `by: "nutritionist"` por cada cita, así `onAppointmentCancelled` avisa a cada paciente por WhatsApp.
4. **Durante la gracia**:
   - `requireNutritionist()` redirige a `/cuenta-eliminada` (fuera de `/app`), que muestra "Tu cuenta se eliminará el {fecha}" y "Cancelar eliminación". Como todas las páginas y server actions del panel pasan por ahí, no hay escrituras en gracia.
   - La página pública `/[slug]`, el booking y `GET /api/v1/public/:slug` responden **404**. `/api/v1/me/*` responde 403.
   - El **slug queda reservado** (la fila sigue ocupando el unique) hasta el purge.
   - `cancelAccountDeletion` (iniciar sesión y tocar el botón) revierte las fechas y audita `account.delete_cancelled`. Las citas canceladas **no** se restauran: las pacientes ya recibieron el aviso.
5. **Purge** (`account/purge`, Inngest, cron diario 03:00 CDMX + evento manual) para cuentas con `deletion_scheduled_for < now()` y `purged_at IS NULL` (índice parcial `nutritionists_deletion_due_idx`). **Anonimiza, no borra**:
   - `patients`: `name = 'Paciente'`, `phone_wa = NULL`, `email = NULL`.
   - `users`: `email = deleted+<id>@granola.invalid`, `name = 'Cuenta eliminada'`, sin foto.
   - `nutritionists`: nombre, bio, foto, WhatsApp, links, tema y token de Google fuera; `slug = eliminada-<id>` (libera el slug); `purged_at = now()`.
   - Borra `sessions`, `accounts` (contraseña y tokens OAuth) y `verifications`; vacía `wa_messages.payload`; desactiva los servicios; borra `avatars/<nutritionist_id>/` en R2 (si R2 está configurado).
   - **Conserva** `appointments`, `payments` y, cuando existan (F2), `measurements` y `clinical_notes`, ligados a la nutri anonimizada.
   - Registra `account.purged` (actor `system:account-purge`).
6. **Qué se conserva de la nutri y por qué**: `cedula` (el expediente retenido debe seguir siendo atribuible a una profesional, NOM-004) e ids de Stripe/Mercado Pago (conciliar pagos ante el SAT). Ningún dato retenido es visible desde la app: la cuenta ya no puede iniciar sesión.

## Alternativas descartadas

- **Hard delete en cascada** (PR #3 original): incumple NOM-004 y SAT.
- **Borrado sin gracia**: no perdona errores y obliga a soporte manual.
- **Marcar el borrado dentro de un JSON (`theme`/flags)**: `deleted_at` necesita índice y filtros propios en cada query pública; una columna es más clara.
- **Índice parcial `WHERE deleted_at IS NULL`**: hoy ninguna query lo aprovecha (las búsquedas por slug ya usan el unique). Se agrega cuando exista el directorio (F6), que lista solo cuentas activas.

## Pendientes

- **TODO(F5) `purge_after`**: columna (≈ `deleted_at + 5 años`) y un segundo job que borre definitivamente lo retenido al vencer el plazo legal. Hoy lo retenido se queda indefinidamente.
- Reembolsos: las citas prepagadas que se cancelan al pedir el borrado no se reembolsan solas (igual que una cancelación manual hoy).
- Cuentas sin contraseña: agregar "olvidé mi contraseña" o re-autenticación por magic link para que puedan autoeliminarse.
- Notas libres (`patients.notes`, texto de reseñas) pueden contener nombres; se conservan como parte del expediente. Revisar con criterio legal si deben redactarse.
- Confirmar con Beto que conservar `cedula` e ids de pago es aceptable como "anonimizado".
