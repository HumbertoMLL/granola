# Plantillas de WhatsApp (Meta Cloud API)

Texto exacto a registrar en **Meta Business Suite → WhatsApp Manager → Plantillas de mensaje**.
Todas son **categoría Utility**, **idioma Español (MEX) = `es_MX`**, sin encabezado, con pie "Granola".
Los builders tipados viven en `packages/whatsapp/src/templates/*.ts` y producen los `components`
(parámetros de cuerpo + botones) en el mismo orden que aquí.

## Reglas de Meta que ya cumple el código

- Los parámetros no llevan saltos de línea, tabs ni más de 4 espacios seguidos (`param()` los limpia).
- Ningún parámetro va vacío (p. ej. online sin link de Meet → "Te mandaremos el link…").
- Los botones URL tienen **sufijo dinámico**: en Meta se registra la URL con `{{1}}` al final y el
  código manda solo el sufijo (token, slug o id). Cambia `https://granola.app` por el dominio real
  **antes** de registrar; Meta no permite editar la URL sin re-aprobar.
- Botón quick reply: el `payload` que regresa en el webhook es `confirm:<appointmentId>`; el parser
  (`parseWebhook`) lo convierte en `intent: { kind: "confirm", appointmentId }`.
- Los nombres de botón (texto visible) sí son fijos en Meta; aquí van entre comillas.
- Fechas en zona horaria del nutri (`nutritionists.timezone`); el paciente no tiene zona en F1.
  Formato: `jueves 29 de octubre, 10:00 a.m.` (se agrega el año solo si no es el actual).

## Dónde se manda cada una

| Plantilla | A quién | Cuándo (función Inngest) |
|---|---|---|
| `cita_confirmada` | paciente | `appointment/confirmed` (no en reagendado) |
| `nueva_cita_nutri` | nutriólogo | `appointment/confirmed` (no en reagendado) |
| `recordatorio_24h` | paciente | `sleepUntil(starts_at − 24h)` |
| `recordatorio_2h` | paciente | `sleepUntil(starts_at − 2h)` |
| `cita_cancelada` | paciente | `appointment/cancelled` |
| `cita_reagendada` | paciente | `appointment/rescheduled` |
| `pago_pendiente_oxxo` | paciente | `appointment/pending_payment` |
| `pide_resena` | paciente | `appointment/completed` (ends_at + 2h) |

---

## 1. `cita_confirmada`

**Cuerpo**

```
Hola {{1}}, tu cita con {{2}} quedó confirmada para el {{3}} ({{4}}).
{{5}}
Si necesitas moverla o cancelarla, usa el botón de abajo.
```

| Var | Contenido | Ejemplo |
|---|---|---|
| {{1}} | primer nombre del paciente | Ana |
| {{2}} | nombre del nutri | Karla Demo |
| {{3}} | fecha y hora | jueves 29 de octubre, 10:00 a.m. |
| {{4}} | modalidad | en línea / presencial |
| {{5}} | detalle | Te conectas aquí: https://meet.google.com/abc-defg-hij · Dirección: Av. Reforma 123, CDMX |

**Botones:** URL "Reagendar o cancelar" → `https://granola.app/cita/{{1}}` (sufijo = `cancel_token`)

**Pie:** Granola

**Ejemplo renderizado**

> Hola Ana, tu cita con Karla Demo quedó confirmada para el jueves 29 de octubre, 10:00 a.m. (en línea).
> Te conectas aquí: https://meet.google.com/abc-defg-hij
> Si necesitas moverla o cancelarla, usa el botón de abajo.
> **[Reagendar o cancelar]**

Builder: `buildCitaConfirmada({ patientName, nutritionistName, startsAt, timeZone, modality, meetUrl, location, cancelToken })`

---

## 2. `recordatorio_24h`

**Cuerpo**

```
Hola {{1}}, te recordamos tu cita con {{2}} mañana a las {{3}} ({{4}}).
{{5}}
¿Nos confirmas que vas?
```

| Var | Contenido | Ejemplo |
|---|---|---|
| {{1}} | primer nombre | Ana |
| {{2}} | nutri | Karla Demo |
| {{3}} | hora | 10:00 a.m. |
| {{4}} | modalidad | en línea |
| {{5}} | detalle (Meet / dirección) | Te conectas aquí: https://meet.google.com/… |

**Botones (en este orden):**
0. Quick reply **"Confirmo"** (payload `confirm:<appointmentId>`)
1. URL **"Reagendar"** → `https://granola.app/cita/{{1}}` (sufijo = `cancel_token`)

**Ejemplo**

> Hola Ana, te recordamos tu cita con Karla Demo mañana a las 10:00 a.m. (en línea).
> Te conectas aquí: https://meet.google.com/abc-defg-hij
> ¿Nos confirmas que vas?
> **[Confirmo]** **[Reagendar]**

Builder: `buildRecordatorio24h({ appointmentId, patientName, nutritionistName, startsAt, timeZone, modality, meetUrl, location, cancelToken })`

---

## 3. `recordatorio_2h`

**Cuerpo**

```
{{1}}, tu cita con {{2}} es hoy a las {{3}} ({{4}}).
{{5}}
¡Te esperamos!
```

| Var | Contenido | Ejemplo |
|---|---|---|
| {{1}} | primer nombre | Ana |
| {{2}} | nutri | Karla Demo |
| {{3}} | hora | 10:00 a.m. |
| {{4}} | modalidad | presencial |
| {{5}} | detalle | Dirección: Av. Reforma 123, CDMX |

**Botones:** URL "Ver mi cita" → `https://granola.app/cita/{{1}}` (sufijo = `cancel_token`)

Builder: `buildRecordatorio2h({ patientName, nutritionistName, startsAt, timeZone, modality, meetUrl, location, cancelToken })`

---

## 4. `cita_cancelada`

**Cuerpo**

```
Hola {{1}}, tu cita con {{2}} del {{3}} fue cancelada {{4}}.
Si quieres volver a agendar, toca el botón.
```

| Var | Contenido | Ejemplo |
|---|---|---|
| {{1}} | primer nombre | Ana |
| {{2}} | nutri | Karla Demo |
| {{3}} | fecha y hora original | jueves 29 de octubre, 10:00 a.m. |
| {{4}} | motivo según `by` | a petición tuya · por Karla Demo · porque no se completó el pago a tiempo |

**Botones:** URL "Agendar otra cita" → `https://granola.app/{{1}}` (sufijo = `slug` del nutri)

**Ejemplo**

> Hola Ana, tu cita con Karla Demo del jueves 29 de octubre, 10:00 a.m. fue cancelada a petición tuya.
> Si quieres volver a agendar, toca el botón.
> **[Agendar otra cita]**

Builder: `buildCitaCancelada({ patientName, nutritionistName, startsAt, timeZone, by, nutritionistSlug })`

---

## 5. `cita_reagendada`

**Cuerpo**

```
Hola {{1}}, tu cita con {{2}} cambió de horario.
Antes: {{3}}
Ahora: {{4}} ({{5}})
{{6}}
```

| Var | Contenido | Ejemplo |
|---|---|---|
| {{1}} | primer nombre | Ana |
| {{2}} | nutri | Karla Demo |
| {{3}} | fecha anterior | martes 27 de octubre, 10:00 a.m. |
| {{4}} | fecha nueva | jueves 29 de octubre, 10:00 a.m. |
| {{5}} | modalidad | en línea |
| {{6}} | detalle | Te conectas aquí: https://meet.google.com/… |

**Botones:** URL "Reagendar o cancelar" → `https://granola.app/cita/{{1}}` (sufijo = `cancel_token`)

Builder: `buildCitaReagendada({ patientName, nutritionistName, previousStartsAt, startsAt, timeZone, modality, meetUrl, location, cancelToken })`

---

## 6. `pago_pendiente_oxxo`

**Cuerpo**

```
Hola {{1}}, tu cita con {{2}} para el {{3}} quedó apartada.
Para confirmarla completa el pago de {{4}} antes del {{5}}; si no, el lugar se libera automáticamente.
```

| Var | Contenido | Ejemplo |
|---|---|---|
| {{1}} | primer nombre | Ana |
| {{2}} | nutri | Karla Demo |
| {{3}} | fecha y hora de la cita | jueves 29 de octubre, 10:00 a.m. |
| {{4}} | monto | $650.00 MXN |
| {{5}} | límite de pago (`expiresAt`) | sábado 25 de octubre, 10:00 a.m. |

**Botones:** URL "Ver referencia de pago" → `https://granola.app/cita/{{1}}` (sufijo = `cancel_token`; la página muestra la referencia OXXO / CLABE SPEI)

Builder: `buildPagoPendienteOxxo({ patientName, nutritionistName, startsAt, timeZone, amountCents, currency, expiresAt, cancelToken })`

---

## 7. `pide_resena`

**Cuerpo**

```
Hola {{1}}, ¿cómo te fue en tu consulta con {{2}}?
Tu opinión ayuda a otras personas a decidirse y le toma un minuto. Solo se publica si tú quieres.
```

| Var | Contenido | Ejemplo |
|---|---|---|
| {{1}} | primer nombre | Ana |
| {{2}} | nutri | Karla Demo |

**Botones:** URL "Dejar reseña" → `https://granola.app/resena/{{1}}` (sufijo = `cancel_token` de la cita)

Builder: `buildPideResena({ patientName, nutritionistName, cancelToken })`

---

## 8. `nueva_cita_nutri` (al nutriólogo)

**Cuerpo**

```
Nueva cita: {{1}} agendó "{{2}}" para el {{3}} ({{4}}).
Pago: {{5}}.
```

| Var | Contenido | Ejemplo |
|---|---|---|
| {{1}} | nombre completo del paciente | Ana López |
| {{2}} | servicio | Primera consulta |
| {{3}} | fecha y hora (zona del nutri) | jueves 29 de octubre, 10:00 a.m. |
| {{4}} | modalidad | presencial |
| {{5}} | estado de pago | pagado en línea · pago pendiente (OXXO/SPEI) · se cobra en consulta · sin costo |

**Botones:** URL "Ver en mi agenda" → `https://granola.app/app/agenda/{{1}}` (sufijo = `appointment.id`)

Builder: `buildNuevaCitaNutri({ appointmentId, patientName, serviceName, startsAt, timeZone, modality, paymentLabel })`

---

## Respuestas de texto libre (sin plantilla)

Cuando el paciente toca **Confirmo**, su mensaje abre la ventana de 24h y el webhook responde con
`sendText`: *"¡Gracias por confirmar! Te esperamos. Si necesitas mover la cita, usa el link que te mandamos."*
Fuera de esa ventana Meta rechaza texto libre (error 131047); por eso todo lo iniciado por nosotros es plantilla.

## Configuración en Meta (pendiente de Beto)

1. **Meta Business → App → WhatsApp → Configuración → Webhook**
   - Callback URL: `https://<dominio>/api/webhooks/whatsapp`
   - Verify token: el valor de `WA_VERIFY_TOKEN` (inventa uno largo; `openssl rand -hex 24`)
   - Campos suscritos: **`messages`** (trae tanto `statuses` como mensajes entrantes). Opcional: `message_template_status_update` (el parser lo ignora sin error).
2. **App → Configuración básica → Clave secreta de la app** → `WA_APP_SECRET` (valida `X-Hub-Signature-256`).
3. **WhatsApp → Primeros pasos**: `WA_PHONE_NUMBER_ID`, `WA_BUSINESS_ACCOUNT_ID`, y un **token de sistema permanente** (System User con permiso `whatsapp_business_messaging`) → `WA_ACCESS_TOKEN`. El token temporal de 24h sirve para probar.
4. Registrar las 8 plantillas con el texto de arriba, categoría *Utility*, idioma *Español (MEX)*. La aprobación suele tardar minutos–horas; las utility rara vez se rechazan.
5. Sustituir `https://granola.app` por el dominio final en los botones URL antes de enviar a aprobación.
6. Variable opcional `WA_GRAPH_VERSION` (default `v21.0`).

Sin `WA_ACCESS_TOKEN` el cliente corre en **dry run**: imprime el payload en el log y registra la fila en
`wa_messages` con `status = queued` y `error_code = dry_run`, así el flujo completo se prueba sin Meta.
