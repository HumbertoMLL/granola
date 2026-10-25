# Prompts para Codex (uno por worktree)

Para cada uno: `cd ~/Desktop/granola && scripts/wt.sh nueva <slug>` → `cd ~/Desktop/granola-wt/<slug> && codex` → pegar.
Orden sugerido y dependencias al final. Fecha: 25 oct 2026.

---

## 1. `calendar` — Google Calendar sync

```
Tarea: Google Calendar sync. Al confirmarse una cita (evento appointment/confirmed) crear el evento en el Google Calendar de la nutrióloga con link de Google Meet si la modalidad es online; al cancelar/reagendar, borrar/mover el evento. Y al calcular slots disponibles, restar los eventos "busy" del calendario de la nutri (free/busy) además de las citas de Granola.

Estás en un git worktree aislado de Granola, en la rama feature/calendar. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, PLAN.md, STACK.md, docs/twelve-factor.md y docs/adr/. Respeta las reglas duras de CLAUDE.md sin excepción. Lee packages/jobs/src/functions/appointment-confirmed.ts, appointment-cancelled.ts, appointment-rescheduled.ts (ahí se engancha), apps/web/src/lib/booking.ts (loadSchedulingContext y computeAvailableSlots: ahí entra el free/busy), packages/db/src/schema/nutritionists.ts (ya existe google_refresh_token_enc) y appointments.ts (google_event_id, meet_url ya existen).

Entregables:
1. packages/google-calendar (nuevo, @granola/google-calendar, sin dependencia de Next): cliente con fetch directo a Google Calendar API v3 (sin googleapis, es pesado): refresh de access token con el refresh token, createEvent (con conferenceData para Meet cuando modality=online), updateEvent, deleteEvent, freeBusy(timeMin,timeMax). Cifrado del refresh token con AES-256-GCM usando una env var GOOGLE_TOKEN_ENC_KEY (32 bytes base64) en packages/google-calendar/src/crypto.ts; nunca guardar el token en claro. Tests vitest con fetch mockeado para los 4 métodos, el refresh y el cifrado.
2. Conexión: Better Auth ya tiene Google como proveedor social en packages/auth/src/index.ts; agrega el scope https://www.googleapis.com/auth/calendar.events y https://www.googleapis.com/auth/calendar.freebusy con accessType offline y prompt consent, y un hook/after-callback que guarde el refresh token cifrado en nutritionists.google_refresh_token_enc. Si el usuario ya tenía sesión por email, ofrecer "Conectar Google Calendar" en /app/configuracion (botón que inicia el linkSocial de Better Auth). Botón "Desconectar" que borra el token.
3. Jobs: en appointment-confirmed crear el evento (step.run idempotente: si ya hay google_event_id, no duplicar) y guardar google_event_id + meet_url en la cita; en cancelled borrar; en rescheduled mover. Si la nutri no tiene token, saltar sin error. Errores de Google no deben tumbar el envío de WhatsApp: el step de calendar va después y aislado.
4. Slots: en loadSchedulingContext, si la nutri tiene token, llamar freeBusy del rango y agregar esos intervalos a busy (con caché en memoria de 60 s por nutri para no pegarle a Google en cada clic; documenta que es por instancia). Si Google falla, calcular slots solo con Granola y loguear.
5. .env.example: GOOGLE_TOKEN_ENC_KEY con comentario de cómo generarla. STACK.md: fila de Google Calendar. docs/adr/0009-google-calendar.md.
6. Tests de integración (apps/web/src/test, proyecto integration de vitest) para: cita confirmada → se llama createEvent y se guardan google_event_id/meet_url (Google mockeado); cancelación → deleteEvent; nutri sin token → no se llama a Google.

Alcance: no toques packages/whatsapp, packages/payments ni la UI de booking salvo mostrar el link de Meet en /listo y /cita/[token] si existe. No crees migraciones (las columnas ya existen).

Terminado significa: pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm --filter @granola/web exec next build en verde (levanta docker-compose -f docker-compose.local.yml up -d antes), commits chicos en español, git push -u origin feature/calendar y gh pr create --fill con resumen, cómo probarlo (incluye qué configurar en Google Cloud Console: scopes y redirect URI) y qué quedó fuera.
```

---

## 2. `resend` — Magic link y correos transaccionales

```
Tarea: Correos transaccionales con Resend. El magic link de Better Auth hoy solo se imprime en consola (packages/auth/src/index.ts, TODO Resend): mandarlo por correo de verdad. Además: correo de bienvenida al registrarse, correo de confirmación de cita al paciente si dio email (complementa al WhatsApp, no lo sustituye) y correo de nueva cita a la nutrióloga.

Estás en un git worktree aislado de Granola, en la rama feature/resend. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, PLAN.md, STACK.md, docs/twelve-factor.md y docs/adr/. Respeta las reglas duras de CLAUDE.md sin excepción. Lee packages/auth/src/index.ts, packages/jobs/src/functions/appointment-confirmed.ts y packages/whatsapp/src/record.ts (patrón de "dry run" sin token: imítalo).

Entregables:
1. packages/email (nuevo, @granola/email, sin Next): cliente Resend vía fetch directo (sin SDK) con sendEmail({to, subject, html, text, tags}); sin RESEND_API_KEY hace dry run (loguea y devuelve id null). Plantillas en src/templates/ como funciones puras que devuelven {subject, html, text}: magicLink, bienvenida, citaConfirmadaPaciente, nuevaCitaNutri, citaCancelada. HTML simple inline-CSS con la paleta de Granola (crema #FBF7F0, café #2B2118, verde #4A7A2B), sin imágenes externas, con versión texto. Tests vitest de cada plantilla (snapshot del texto, no del HTML) y del cliente en dry run.
2. Better Auth: sendMagicLink usa @granola/email; también emailVerification si está habilitada. Remitente desde EMAIL_FROM (p. ej. "Granola <hola@granola.app>").
3. Jobs: en appointment-confirmed, después del WhatsApp, step aislado que manda el correo al paciente si tiene email y a la nutri siempre; en cancelled, correo al paciente. Registrar cada envío en una tabla nueva NO: usa la columna payload de wa_messages NO. Decisión: no persistir correos en F1; solo log. Anótalo en el ADR.
4. Webhook de Resend opcional: NO en este PR; anótalo como pendiente.
5. .env.example: RESEND_API_KEY ya existe; agrega EMAIL_FROM. STACK.md: fila Resend con costo (free 3,000/mes, verifica en resend.com/pricing y cita fecha). docs/adr/0010-email-resend.md.
6. Test de integración: cita confirmada con paciente con email → se llama sendEmail dos veces (paciente y nutri) con los asuntos esperados (Resend mockeado).

Alcance: no toques packages/whatsapp ni packages/payments. No cambies el comportamiento del login salvo el envío real.

Terminado significa: pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm --filter @granola/web exec next build en verde (docker-compose -f docker-compose.local.yml up -d antes), commits chicos en español, git push -u origin feature/resend y gh pr create --fill con resumen, cómo probarlo (dominio a verificar en Resend) y qué quedó fuera.
```

---

## 3. `ratelimit` — Rate limiter distribuido (twelve-factor VI)

```
Tarea: Sacar el rate limiter de la memoria del proceso. Hoy packages/api/src/rate-limit.ts guarda contadores en globalThis, que en Vercel se multiplica por instancia (ver docs/twelve-factor.md, factor VI). Implementar un store intercambiable: Upstash Redis (REST, vía fetch, sin SDK) en producción y memoria en dev/test, elegido por env var.

Estás en un git worktree aislado de Granola, en la rama feature/ratelimit. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, STACK.md, docs/twelve-factor.md, docs/adr/0007-hono-api-v1.md y packages/api/src/rate-limit.ts, packages/api/src/middleware/rate-limit.ts y sus tests. Respeta las reglas duras de CLAUDE.md.

Entregables:
1. Interfaz RateLimitStore { incr(key, windowMs): Promise<{count, resetAt}> } con dos implementaciones: MemoryStore (la actual, refactorizada) y UpstashStore (ventana fija con INCR + PEXPIRE en un pipeline REST de Upstash: POST {UPSTASH_REDIS_REST_URL}/pipeline con bearer {UPSTASH_REDIS_REST_TOKEN}). Selección en src/store.ts: si existen las dos env vars → Upstash, si no → memoria con warning una sola vez en producción (NODE_ENV=production) de "rate limit no distribuido".
2. checkRateLimit y el middleware de Hono pasan a async (ya lo son o ajústalos) y usan el store. Fail-open documentado: si Upstash falla o tarda más de 500 ms, permitir y loguear (no bloquear reservas por un Redis caído).
3. Headers estándar en respuestas de la API: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset y Retry-After en 429.
4. Tests vitest: MemoryStore (ventana, reset), UpstashStore con fetch mockeado (pipeline correcto, fail-open por error y por timeout), middleware con headers. Mantén en verde los tests existentes de packages/api.
5. .env.example: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN. STACK.md: fila Upstash (free 10K comandos/día; verifica en upstash.com/pricing con fecha). docs/twelve-factor.md: marca VI como ✅ con la evidencia. docs/adr/0011-rate-limit-store.md.

Alcance: solo packages/api, docs y .env.example. No toques las server actions que llaman checkRateLimit salvo que cambie la firma (si la cambias, actualiza las 3 llamadas en apps/web/src/app/[slug]/agendar/actions.ts, cita/[cancelToken]/actions.ts y resena/[cancelToken]/actions.ts con el cambio mínimo).

Terminado significa: pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @granola/web exec next build en verde, commits chicos en español, git push -u origin feature/ratelimit y gh pr create --fill con resumen, cómo probarlo y qué quedó fuera.
```

---

## 4. `migrate-deploy` — Migraciones como paso del release (twelve-factor V)

```
Tarea: Que las migraciones de base de datos se apliquen como parte del deploy y no a mano (docs/twelve-factor.md, factor V). Hoy `pnpm db:migrate` se corre manualmente contra Neon.

Estás en un git worktree aislado de Granola, en la rama feature/migrate-deploy. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, STACK.md, docs/twelve-factor.md, .github/workflows/ci.yml y su README.md, packages/db/drizzle.config.ts, packages/db/README.md y neon.ts. Respeta las reglas duras de CLAUDE.md.

Entregables:
1. Workflow .github/workflows/deploy.yml: en push a main, después de que el workflow CI termine en verde (workflow_run con conclusion success), job "migrate" que corre `pnpm --filter @granola/db migrate` contra `secrets.DATABASE_URL` (Neon producción) usando drizzle-kit con el driver de Neon (funciona contra Neon real, no contra el proxy local). Concurrency group "migrate-prod" para que nunca corran dos a la vez. Si la migración falla, el job falla y NO se promueve el deploy: documenta en el README cómo se coordina con Vercel (opción recomendada: Vercel sigue desplegando en cada push, pero el código debe ser compatible hacia atrás con el schema anterior — regla "expand/contract": primero agregar columnas, nunca renombrar/borrar en el mismo PR que las deja de usar; escribe esa regla en CLAUDE.md y AGENTS.md).
2. Neon branch de preview: en pull_request, job que crea (o reutiliza) un branch de Neon llamado pr-<número> desde production con `npx neon@8 branches create` (o la API REST con secrets.NEON_API_KEY y NEON_PROJECT_ID), corre las migraciones ahí y publica la URL en un comentario del PR; al cerrar el PR, job que borra el branch. Esto prueba que la migración del PR aplica sobre datos reales sin tocar producción. Si no puedes verificarlo sin las keys, deja el YAML listo, con `if: ${{ secrets.NEON_API_KEY != '' }}` y explica en el PR qué secrets hay que cargar.
3. Guard local: script scripts/check-migrations.ts (pnpm check:migrations) que falla si hay cambios en packages/db/src/schema sin migración nueva (`drizzle-kit generate --dry-run` o `drizzle-kit check`) y agrégalo al job de lint/typecheck de ci.yml.
4. Docs: packages/db/README.md (flujo nuevo), .github/workflows/README.md (secrets necesarios: DATABASE_URL, NEON_API_KEY, NEON_PROJECT_ID), docs/twelve-factor.md (V → ✅ cuando quede), docs/adr/0012-migraciones-en-deploy.md.

Alcance: workflows, scripts, packages/db docs, CLAUDE.md/AGENTS.md (solo la regla expand/contract). No cambies el schema ni crees migraciones.

Terminado significa: YAML validado con `actionlint` (instálalo con brew si no está) y `pnpm typecheck && pnpm lint && pnpm test` en verde, commits chicos en español, git push -u origin feature/migrate-deploy y gh pr create --fill con resumen, los secrets que yo debo cargar en GitHub y qué quedó fuera.
```

---

## 5. `logs` — Logs estructurados + Sentry (twelve-factor XI)

> Hacerlo **al final** de la tanda: toca muchos archivos y choca con todo lo demás.

```
Tarea: Logs estructurados y errores a Sentry (docs/twelve-factor.md, factor XI). Hoy todo es console.* sin estructura.

Estás en un git worktree aislado de Granola, en la rama feature/logs. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, STACK.md, docs/twelve-factor.md y docs/adr/. Respeta las reglas duras de CLAUDE.md. Lee cómo loguean hoy packages/whatsapp/src/client.ts, packages/payments/src/*/webhook.ts, packages/jobs/src/lib/send.ts y apps/web/src/app/api/webhooks/*/route.ts.

Entregables:
1. packages/logger (nuevo, @granola/logger): pino con salida JSON a stdout (nunca a archivo), nivel por LOG_LEVEL, pretty solo en desarrollo (pino-pretty como devDep), campos base {service, env, requestId}. Helper withRequestId(headers) que toma x-vercel-id o x-request-id o genera uno. REDACCIÓN obligatoria: lista de paths que se enmascaran siempre (phoneWa, phone_wa, email, password, token, cancelToken, access_token, authorization, cookie, DATABASE_URL, *.secret) — datos de salud y de contacto nunca en logs. Tests de que la redacción funciona.
2. Reemplazar console.* por el logger en packages/whatsapp, packages/payments, packages/jobs, packages/api y en las rutas api/webhooks/* y api/inngest de apps/web. Mantén los mensajes en español. No toques componentes React ni server actions del panel en este PR (solo capa de servicios y rutas).
3. Sentry: @sentry/nextjs con la config mínima (sentry.client/server/edge.config.ts, instrumentation.ts, withSentryConfig en next.config.ts solo si SENTRY_DSN existe), beforeSend que aplica la misma redacción, tracesSampleRate 0.1, sin source maps subidos todavía (anota cómo hacerlo con SENTRY_AUTH_TOKEN). Captura también en las funciones Inngest (onFailure).
4. Health: /api/v1/health devuelve además versión (VERCEL_GIT_COMMIT_SHA o "dev") y región.
5. .env.example: LOG_LEVEL, SENTRY_DSN ya existe, NEXT_PUBLIC_SENTRY_DSN, SENTRY_ENVIRONMENT. STACK.md: filas Sentry (free 5K errores/mes; verifica en sentry.io/pricing con fecha) y logger. docs/twelve-factor.md: XI → ✅. docs/adr/0013-logs-y-sentry.md.

Alcance: lo listado. Si una dependencia de Sentry rompe el build con cacheComponents o Turbopack, repórtalo y deja Sentry desactivado por flag en vez de pelear horas.

Terminado significa: pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @granola/web exec next build en verde, un ejemplo de línea de log JSON en el PR, commits chicos en español, git push -u origin feature/logs y gh pr create --fill con resumen, cómo probarlo y qué quedó fuera.
```

---

## 6. `inbody` — InBody / labs: subir, leer, personalizar y enviar (F2)

> Requiere que el PR #2 (expediente) esté mergeado en `main`. Crear el worktree **después**.

```
Tarea: InBody y análisis de laboratorio en el expediente. La nutrióloga sube el PDF (o foto) del InBody que el paciente se hizo en otro lado, Granola extrae los datos, la nutri los revisa y PERSONALIZA (comentarios por indicador, qué mostrar y qué no, su interpretación, su marca) y genera una versión propia para mandarle al paciente por WhatsApp/correo como PDF con su logo. Lo mismo para labs (glucosa, perfil lipídico, HbA1c, etc.).

Estás en un git worktree aislado de Granola, en la rama feature/inbody. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, PLAN.md (F2), STACK.md, docs/twelve-factor.md, docs/adr/ y el código de pacientes/expediente que ya está en main (apps/web/src/app/(panel)/app/pacientes/**, packages/db/src/schema/measurements.ts y clinical_notes.ts, packages/core/src/nutrition/). Respeta las reglas duras de CLAUDE.md sin excepción: datos de salud nunca al cliente sin pasar por la API, filtro por nutritionist_id, consentimiento, audit_log en lecturas y escrituras.

Entregables:
1. Schema (eres el único con migración en esta tanda: 0003_inbody): tabla documents (id, nutritionist_id, patient_id, kind: 'inbody'|'labs'|'otro', storage_key, mime, size_bytes, uploaded_at, parsed_status: 'pending'|'ok'|'failed', parsed_json jsonb, parse_error) y tabla reports (id, document_id, nutritionist_id, patient_id, template: 'inbody'|'labs', content jsonb — la versión personalizada: indicadores con valor, unidad, rango, visible, comentario de la nutri —, brand jsonb — logo_url, color, firma —, pdf_storage_key, sent_at, sent_via: 'whatsapp'|'email'|null, created_at). Índices por (nutritionist_id, patient_id). Relations.
2. Subida: a Cloudflare R2 con apps/web/src/lib/storage.ts (ya existe putObject/createSignedUploadUrl; si R2 no está configurado, guardar en disco local bajo .uploads/ solo en desarrollo, nunca en prod). Límite 15 MB, mime pdf/jpg/png. Guardar storage_key, nunca URL pública: todo acceso vía ruta firmada de corta vida.
3. Extracción: packages/core/src/documents/ (puro, sin IO): parsers de texto para InBody 270/570/770 (peso, masa muscular esquelética, masa grasa, % grasa, agua corporal, IMC, tasa metabólica basal, segmentos) y de labs comunes (glucosa, HbA1c, colesterol total, LDL, HDL, triglicéridos, creatinina, TSH, vitamina D) con unidades y rangos de referencia por defecto. El texto del PDF se obtiene con pdf-parse (o pdfjs-dist) en un route handler; para imágenes, OCR fuera de alcance: marcar parsed_status failed con mensaje "sube el PDF" y permitir captura manual. Tests vitest con fixtures de texto de 2 InBody y 2 labs anonimizados que tú inventes.
4. UI en la ficha del paciente, tab "Documentos": subir, ver estado de extracción, botón "Revisar y personalizar" → editor del reporte: tabla de indicadores (valor extraído editable, unidad, rango, toggle visible, comentario), bloque "Mi interpretación" (texto libre), marca (toma avatar/nombre/cédula de nutritionists y permite color), vista previa, "Generar PDF". PDF con @react-pdf/renderer (o la lib que ya use el repo si existe) en un route handler, guardado en R2, descargable con URL firmada. "Enviar al paciente": por WhatsApp usa packages/whatsapp con una plantilla nueva `reporte_listo` (documenta el texto en docs/whatsapp-plantillas.md; en dry run solo registra) con link firmado de 7 días; por correo si existe @granola/email en main, si no, deja el botón deshabilitado con TODO.
5. Comparativa: en Antropometría, si hay ≥2 InBody, mostrar la evolución (peso, % grasa, masa muscular) junto con las measurements manuales que ya existen.
6. Tests de integración: subir documento → row con parsed_status; crear reporte → content con indicadores visibles; aislamiento por tenant (nutri A no ve documentos de B); URL firmada expira.

Alcance: lo listado. No toques pagos, agenda ni auth. Notas por grabación de voz NO están en alcance (decisión de Beto).

Terminado significa: pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm --filter @granola/web exec next build en verde (docker-compose -f docker-compose.local.yml up -d antes; aplica tu migración con psql en tu DB), commits chicos en español, git push -u origin feature/inbody y gh pr create --fill con resumen, capturas o descripción de cómo probarlo y qué quedó fuera.
```

---

## 7. `importador` — Importar pacientes desde Avena / Nutrimind / Excel (F2)

> Requiere PR #2 mergeado. No crea migraciones.

```
Tarea: Importador de pacientes. Una nutrióloga que viene de Avena, Nutrimind o de un Excel propio sube un CSV/XLSX y Granola crea sus pacientes (y opcionalmente medidas históricas) sin duplicar.

Estás en un git worktree aislado de Granola, en la rama feature/importador. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, PLAN.md, STACK.md, docs/twelve-factor.md, docs/adr/ y el código de pacientes en main (apps/web/src/app/(panel)/app/pacientes/**, packages/db/src/schema/patients.ts y measurements.ts). Respeta las reglas duras de CLAUDE.md: consentimiento LFPDPPP obligatorio (en importación, la nutri declara bajo su responsabilidad que tiene el consentimiento: checkbox + texto legal, se guarda consent_at = ahora, consent_ip y source = 'import'), filtro por nutritionist_id, audit_log.

Entregables:
1. packages/core/src/import/ (puro): parser de CSV (sin librería pesada; maneja comillas y BOM) y de XLSX (usa `xlsx` SheetJS o `exceljs`, elige la más ligera y justifica); detección automática de columnas por sinónimos en español e inglés (nombre, apellido, teléfono/celular/whatsapp, correo/email, fecha de nacimiento, sexo, peso, estatura/talla, fecha de medición, notas) con mapeo editable; normalización de teléfono a E.164 MX (reutiliza normalizePhoneMx de @granola/whatsapp si se puede importar sin IO; si no, copia la función a core con test); dedupe por teléfono y por (nombre + fecha de nacimiento); reporte de validación por fila (ok / advertencia / error con motivo). Tests vitest con fixtures: export real de Avena (inventa uno plausible con sus encabezados típicos: "Nombre", "Teléfono", "Correo", "Fecha de nacimiento", "Peso", "Talla"), uno de Nutrimind y un Excel desordenado.
2. UI /app/pacientes/importar: paso 1 subir archivo (≤ 5 MB, ≤ 2,000 filas), paso 2 mapeo de columnas con vista previa de 5 filas y conteo de ok/advertencias/errores, paso 3 checkbox de consentimiento declarado + "Importar", paso 4 resultado (creados, actualizados, omitidos, errores descargables como CSV). Todo en server actions con zod; inserción por lotes de 100 en db.batch; idempotente si se vuelve a subir el mismo archivo (dedupe).
3. Tests de integración: importa 3 filas (1 nueva, 1 duplicada por teléfono, 1 inválida) → 1 creada, 1 omitida, 1 error; aislamiento por tenant.
4. Docs: sección en docs/granola-overview.html NO (no toques el overview); agrega docs/importar-pacientes.md con los formatos soportados.

Alcance: lo listado. Sin migraciones. No toques agenda, pagos ni auth.

Terminado significa: pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm --filter @granola/web exec next build en verde (docker-compose -f docker-compose.local.yml up -d antes), commits chicos en español, git push -u origin feature/importador y gh pr create --fill con resumen, cómo probarlo y qué quedó fuera.
```

---

## Orden y dependencias

| Tanda | Worktrees en paralelo | Condición |
|---|---|---|
| A (ya) | `calendar`, `resend`, `ratelimit`, `migrate-deploy` | archivos distintos entre sí; arrancar hoy |
| B | `inbody`, `importador` | después de mergear PR #2 (expediente) |
| C | `logs` | solo, al final de la tanda A/B (toca todo) |

Merge en el orden en que lleguen dentro de la tanda; `logs` siempre al último. Si dos PRs tocan `.env.example`, `STACK.md` o `docs/twelve-factor.md`, el segundo se resuelve a mano (son conflictos triviales).
