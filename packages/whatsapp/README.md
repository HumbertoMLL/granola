# @granola/whatsapp

Cliente de Meta WhatsApp Cloud API (Graph v21, `fetch` directo, sin SDK), plantillas tipadas y parser de webhooks.
Regla dura #4: **todo lo que sale por WhatsApp pasa por aquí y queda en `wa_messages`.**

- `createWhatsAppClient()` → `sendTemplate`, `sendText` (solo ventana 24h), `markRead`. Sin `WA_ACCESS_TOKEN` corre en **dry run** (loguea el payload; `recordOutbound` guarda `queued` + `error_code = dry_run`).
- `normalizePhoneMx("33 1234 5678")` → `+523312345678` (quita el 1 viejo, 01/044/045).
- `templates/` → `buildCitaConfirmada`, `buildRecordatorio24h`, … devuelven `{ name, language, components }`. Texto para registrar en Meta: `docs/whatsapp-plantillas.md`.
- `sendTemplateAndRecord({ db, client, nutritionistId, patientId, to, template })` envía + registra; si Meta rechaza registra `failed` y relanza `WhatsAppApiError` (con `retriable`).
- Webhooks: `verifyWebhookChallenge`, `verifySignature` (X-Hub-Signature-256 con `WA_APP_SECRET`), `parseWebhook` → `{ statuses, inbound }` con `intent` (confirm / reschedule); `applyStatusUpdates`, `resolveInboundContext`, `recordInbound` (idempotente por `wa_message_id`).

```bash
pnpm --filter @granola/whatsapp test
```
