# Prompts para Codex (uno por worktree)

Para cada uno: `cd ~/Desktop/granola && scripts/wt.sh nueva <slug>` → `cd ~/Desktop/granola-wt/<slug> && codex` → pegar.
Orden sugerido y dependencias al final. Fecha: 25 oct 2026.

---

## 1. `calendar` ✅ mergeado — Google Calendar sync

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

## 2. `resend` ✅ mergeado — Magic link y correos transaccionales

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

## 3. `ratelimit` ✅ mergeado — Rate limiter distribuido (twelve-factor VI)

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

## 4. `migrate-deploy` ✅ mergeado — Migraciones como paso del release (twelve-factor V)

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

## 5. `logs` — Logs estructurados + Sentry (twelve-factor XI) · PENDIENTE

```
Tarea: Logs estructurados y errores a Sentry (docs/twelve-factor.md, factor XI, el único ⚠️ que queda). Hoy todo es console.* sin estructura.

Estás en un git worktree aislado de Granola, en la rama feature/logs. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, STACK.md, docs/twelve-factor.md, docs/ux-decisions.md y docs/adr/ (hay 15 ADRs; el tuyo será 0016). Respeta las reglas duras de CLAUDE.md. Lee cómo loguean hoy packages/whatsapp/src/client.ts, packages/email/src/*, packages/google-calendar/src/*, packages/payments/src/*/webhook.ts, packages/jobs/src/lib/*.ts, packages/api/src/*, apps/web/src/app/api/webhooks/*/route.ts y apps/web/src/app/api/inngest/route.ts.

Entregables:
1. packages/logger (nuevo, @granola/logger): pino con JSON a stdout (nunca a archivo), nivel por LOG_LEVEL, pino-pretty solo en desarrollo (devDep), campos base {service, env, requestId, release: VERCEL_GIT_COMMIT_SHA ?? "dev"}. Helper withRequestId(headers) que toma x-vercel-id o x-request-id o genera uno. REDACCIÓN obligatoria con la lista: phoneWa, phone_wa, phone, email, password, token, cancelToken, cancel_token, access_token, refresh_token, authorization, cookie, DATABASE_URL, *.secret, *.key, clabe, reference — datos de salud y de contacto nunca en logs. Tests vitest de la redacción (objetos anidados y arrays) y del formato.
2. Reemplazar console.* por el logger en packages/whatsapp, email, google-calendar, payments, jobs, api y en las rutas api/webhooks/* y api/inngest de apps/web. Mensajes en español. No toques componentes React ni server actions del panel en este PR (solo capa de servicios y rutas); las server actions públicas (agendar, cita, resena) sí: registra intento de reserva, rate-limit excedido y conflicto de horario con requestId.
3. Sentry: @sentry/nextjs con config mínima (instrumentation.ts, instrumentation-client.ts, withSentryConfig en next.config.ts solo si SENTRY_DSN existe), beforeSend que aplica la misma redacción, tracesSampleRate 0.1, sin subir source maps aún (documenta SENTRY_AUTH_TOKEN). Captura en funciones Inngest (onFailure) y en las rutas de webhooks. Debe compilar con cacheComponents y Turbopack; si rompe el build, deja Sentry detrás de un flag y repórtalo en vez de pelear horas.
4. /api/v1/health devuelve además release (sha corto) y region (VERCEL_REGION ?? "local").
5. .env.example: LOG_LEVEL, NEXT_PUBLIC_SENTRY_DSN, SENTRY_ENVIRONMENT (SENTRY_DSN ya existe). STACK.md: filas Sentry (verifica free tier en sentry.io/pricing con fecha) y logger. docs/twelve-factor.md: XI → ✅ con evidencia y balance a 12 ✅. docs/adr/0016-logs-y-sentry.md.

Alcance: lo listado. Sin migraciones. No toques packages/db ni UI.

Terminado significa: pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm --filter @granola/web exec next build en verde (docker-compose -f docker-compose.local.yml up -d antes), un ejemplo de línea de log JSON en el PR, commits chicos en español, git push -u origin feature/logs y gh pr create --fill con resumen, cómo probarlo y qué quedó fuera.
```

---

## 6. `inbody` — InBody / labs: subir, leer, personalizar y enviar (F2) · PENDIENTE

```
Tarea: InBody y análisis de laboratorio en el expediente. La nutrióloga sube el PDF del InBody que el paciente se hizo en otro lado, Granola extrae los datos, la nutri los revisa y PERSONALIZA (comentario por indicador, qué mostrar, su interpretación, su marca) y genera una versión propia en PDF para mandarla al paciente por WhatsApp y correo. Lo mismo para labs (glucosa, HbA1c, perfil lipídico, etc.).

Estás en un git worktree aislado de Granola, en la rama feature/inbody. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, PLAN.md (F2), STACK.md, docs/twelve-factor.md, docs/ux-decisions.md (reglas de patrones y primitivos de packages/ui: Sheet, Dialog, EmptyState, FormField, Stepper…), docs/adr/ y el código actual de pacientes: apps/web/src/app/(panel)/app/pacientes/**, apps/web/src/components/pacientes/**, packages/db/src/schema/{measurements,clinical_notes,patients}.ts, packages/core/src/nutrition/, packages/email (ya existe: usa sendEmail y agrega una plantilla reporteListo), packages/whatsapp (plantillas tipadas; agrega reporte_listo y documéntala en docs/whatsapp-plantillas.md), apps/web/src/lib/storage.ts (R2). Respeta las reglas duras: datos de salud nunca al cliente sin pasar por la API, filtro por nutritionist_id, consentimiento, audit_log en lecturas y escrituras.

Entregables:
1. Schema y migración 0005_documents (eres el único con migración en esta tanda; sigue la regla expand/contract de CLAUDE.md; genera con pnpm db:generate --name documents y verifica que el journal quede idx 0..5): tabla documents (id, nutritionist_id, patient_id, kind: 'inbody'|'labs'|'otro', storage_key, mime, size_bytes, uploaded_at, parsed_status: 'pending'|'ok'|'failed', parsed_json jsonb, parse_error text) y tabla reports (id, document_id, nutritionist_id, patient_id, template: 'inbody'|'labs', content jsonb — indicadores: clave, etiqueta, valor, unidad, rango_min, rango_max, visible, comentario —, interpretation text, brand jsonb — logo_url, color, firma —, pdf_storage_key, sent_at, sent_via: 'whatsapp'|'email'|null, created_at, updated_at). Índices por (nutritionist_id, patient_id). Relations. Ambas tablas entran en el export de cuenta (configuracion) y en el purge del borrado lógico (packages/jobs: anonimizar/borrar archivos de R2) — cambio mínimo en esos dos puntos.
2. Subida a R2 con putObject (límite 15 MB; mime pdf/jpg/png); sin R2 configurado, guardar bajo .uploads/ solo en desarrollo (nunca en prod; falla con mensaje claro). Nunca URL pública: descarga por ruta firmada de corta vida (10 min) que valida tenant.
3. Extracción en packages/core/src/documents/ (puro): parsers de texto para InBody 270/570/770 (peso, masa muscular esquelética, masa grasa, % grasa, agua corporal, IMC, TMB, segmentos) y labs comunes (glucosa, HbA1c, colesterol total, LDL, HDL, triglicéridos, creatinina, TSH, vitamina D) con unidades y rangos de referencia por defecto. El texto del PDF se obtiene con pdf-parse o pdfjs-dist en un route handler. Imágenes: OCR fuera de alcance → parsed_status failed con "sube el PDF" y captura manual de indicadores. Tests vitest con fixtures de texto (2 InBody + 2 labs inventados y anonimizados).
4. UI en la ficha del paciente, tab "Documentos" (sigue docs/ux-decisions.md: lista semántica, EmptyState, Sheet para editar, Dialog solo para confirmar, un botón primario): subir, estado de extracción, "Revisar y personalizar" → editor del reporte: tabla de indicadores (valor editable, unidad, rango, toggle visible, comentario), "Mi interpretación", marca (toma avatar/nombre/cédula de nutritionists; color del tema), vista previa, "Generar PDF" (@react-pdf/renderer en route handler, guardado en R2), "Enviar al paciente" por WhatsApp (plantilla reporte_listo con link firmado de 7 días; en dry run solo registra) y por correo (@granola/email). Registrar sent_at/sent_via.
5. Evolución: si hay ≥2 InBody, en Antropometría graficar peso, % grasa y masa muscular junto con las measurements manuales.
6. Tests de integración (apps/web/src/test o junto a las actions, proyecto integration): subir documento → row con parsed_status; crear y editar reporte → content con visibles; nutri B no ve ni edita documentos/reportes de A; URL firmada expira; envío registra sent_via.

Alcance: lo listado. No toques pagos, agenda, auth ni el booking. Notas por grabación de voz NO están en alcance (decisión de Beto).

Terminado significa: pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm --filter @granola/web exec next build en verde (docker-compose -f docker-compose.local.yml up -d antes; aplica tu migración con psql en tu DB local), capturas móviles del flujo en el PR, commits chicos en español, git push -u origin feature/inbody y gh pr create --fill con resumen, cómo probarlo y qué quedó fuera.
```

---

## 7. `importador` — Importar pacientes desde Avena / Nutrimind / Excel (F2) · PENDIENTE

> Sin migraciones. Puede correr en paralelo con `inbody` y `logs`.

```
Tarea: Importador de pacientes. Una nutrióloga que viene de Avena, Nutrimind o de un Excel propio sube un CSV/XLSX y Granola crea sus pacientes (y opcionalmente medidas históricas) sin duplicar.

Estás en un git worktree aislado de Granola, en la rama feature/importador. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, PLAN.md, STACK.md, docs/twelve-factor.md, docs/ux-decisions.md (Stepper, FormField, EmptyState, AppliedFilters de packages/ui) y docs/adr/, y el código de pacientes en main: apps/web/src/app/(panel)/app/pacientes/**, apps/web/src/components/pacientes/**, packages/db/src/schema/{patients,measurements}.ts. Respeta las reglas duras: consentimiento LFPDPPP obligatorio (en importación la nutri declara bajo su responsabilidad que lo tiene: checkbox + texto legal; se guarda consent_at = ahora, consent_ip con getClientIp() de apps/web/src/lib/request.ts y source = 'import'), filtro por nutritionist_id, audit_log.

Entregables:
1. packages/core/src/import/ (puro): parser CSV propio (comillas, BOM, ; o ,) y XLSX con la librería más ligera que encuentres (justifica); detección automática de columnas por sinónimos es/en (nombre, apellido, teléfono/celular/whatsapp, correo/email, fecha de nacimiento, sexo, peso, estatura/talla, fecha de medición, notas) con mapeo editable; normalización de teléfono a E.164 MX (reutiliza normalizePhoneMx de @granola/whatsapp si no arrastra IO; si no, copia con test); dedupe por teléfono y por (nombre + fecha de nacimiento); reporte por fila (ok / advertencia / error con motivo). Tests vitest con fixtures: export plausible de Avena ("Nombre", "Teléfono", "Correo", "Fecha de nacimiento", "Peso", "Talla"), uno de Nutrimind y un Excel desordenado.
2. UI /app/pacientes/importar con Stepper de 4 pasos: subir archivo (≤ 5 MB, ≤ 2,000 filas) → mapeo de columnas con vista previa de 5 filas y conteo ok/advertencias/errores → consentimiento declarado + "Importar" → resultado (creados, actualizados, omitidos, errores descargables como CSV). Server actions con zod; inserción por lotes de 100 con db.batch; idempotente si se vuelve a subir el mismo archivo.
3. Tests de integración: importa 3 filas (1 nueva, 1 duplicada por teléfono, 1 inválida) → 1 creada, 1 omitida, 1 error; nutri B no ve lo importado por A; audit_log registra patients.import con conteos.
4. docs/importar-pacientes.md con formatos soportados y entrada en el menú de Pacientes ("Importar").

Alcance: lo listado. Sin migraciones. No toques agenda, pagos ni auth.

Terminado significa: pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm --filter @granola/web exec next build en verde (docker-compose -f docker-compose.local.yml up -d antes), commits chicos en español, git push -u origin feature/importador y gh pr create --fill con resumen, cómo probarlo y qué quedó fuera.
```

---

## 8. `post-integracion` — Ajustes chicos que dejaron los merges · PENDIENTE

> Pequeño; puede ir con cualquiera de los anteriores en paralelo.

```
Tarea: Cerrar los cabos sueltos que dejó la integración de los PRs #1–#10.

Estás en un git worktree aislado de Granola, en la rama feature/post-integracion. Lee AGENTS.md, CLAUDE.md, docs/twelve-factor.md y docs/adr/. Respeta las reglas duras.

1. packages/jobs/src/functions/appointment-confirmed.ts: el correo de confirmación al paciente se manda antes del step de Google Calendar, así que puede salir sin link de Meet. Mueve el correo después de los steps calendar-confirmed / calendar-meet-N, recargando la cita (loadAppointment) para tomar meet_url; el WhatsApp de confirmación también debe llevar el link si ya existe. Ajusta los tests de integración de jobs (email-jobs.int.test.ts y los de calendar) al orden nuevo.
2. Toggle "avisarme por WhatsApp cuando agenden" (quitado del PR #3): agrégalo bien: migración 0006 con columna nutritionists.notify_new_booking boolean not null default true (expand), switch en /app/configuracion → Notificaciones, y packages/jobs respeta la columna al mandar nueva_cita_nutri. Test de integración: con false no se envía. Coordina el número de migración con el PR de inbody (0005): si él aún no está en main cuando abras el PR, usa 0005 y avísalo en el PR para que el integrador renumere.
3. docs/granola-overview.html: sección 4 "Estado": actualiza "hecho" (dashboard real, expediente, onboarding, Docker completo, borrado lógico, UX nueva, calendar, resend, ratelimit, migraciones en deploy) y "siguiente" (logs, inbody, importador). No cambies el diseño del documento.
4. II de twelve-factor: fija versiones de CLIs en docs y scripts (`npx neon@8`, `vercel@65`) y quita el ⚠️ menor de la tabla.
5. CI: documenta en .github/workflows/README.md cómo volver requerido el job "Docker (build runner)"; no lo actives.

Terminado significa: pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration en verde (docker-compose -f docker-compose.local.yml up -d antes), commits chicos en español, git push -u origin feature/post-integracion y gh pr create --fill.
```

---

## Orden y dependencias (actualizado 25 oct 2026, noche)

| Tanda | Worktrees en paralelo | Nota |
|---|---|---|
| ✅ hechas | `calendar`, `resend`, `ratelimit`, `migrate-deploy`, `dashboard`, `configuracion`, `expediente`, `docker`, `ux`, `cuenta-borrado` | todo en `main` |
| **Ahora** | `inbody`, `importador`, `post-integracion` | archivos distintos; `inbody` lleva migración 0005 y `post-integracion` 0006 (el integrador renumera si llegan al revés) |
| Después | `logs` | solo, al final: toca todos los paquetes |

Siguiente fase tras esto: F3 (motor de planes SMAE + recetas + PDF con marca) — prompts por escribir.

---

## 9. `diseno` — Rediseño visual de clase mundial (anti "AI look") · PENDIENTE

> Va después de que entren inbody / importador / post-integración (toca toda la UI). Prompt completo abajo; el texto canónico es este archivo.

```
Tarea: Rediseño visual de Granola para que se vea como una plataforma de clase mundial, no como una app generada por IA. Es un trabajo de DISEÑO ejecutado en código: sistema visual, jerarquía, ritmo, densidad y detalle. No cambias funcionalidad, server actions, schema ni rutas.

Trabaja en un worktree aislado de Granola, en una rama nueva feature/diseno desde main. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, docs/ux-decisions.md (las estructuras por pantalla y las 12 reglas de patrones YA están decididas: no las cambies, mejóralas visualmente), docs/ux-audit.md, packages/ui/src/styles.css y packages/ui/src/*.tsx (el design system actual), docs/adr/0003 y 0014, y recorre la app con el seed (login karla@granola.demo / granola-demo-2026, DB local: docker-compose -f docker-compose.local.yml up -d; next dev -p 3100): /, /login, /karla, /karla/agendar (los 4 pasos), /app, /app/agenda (Día y Semana), /app/pacientes y una ficha, /app/cobros, /app/mi-pagina, /app/configuracion, /cita/<token>, /resena/<token>. Toma capturas móviles (390 px) y desktop (1280 px) de TODAS antes de empezar: son el "antes" del PR.

DIAGNÓSTICO (lo que hoy delata "hecho por IA"; confírmalo tú con las capturas y corrígelo en todas partes):
1. Todo es una tarjeta. Cada bloque va en una card blanca con el mismo radio y la misma sombra, flotando sobre crema, sin jerarquía: el dashboard son seis cajas del mismo peso. Las plataformas serias usan superficies para AGRUPAR y separadores/espacio para el resto.
2. Subtítulos de relleno bajo cada título ("Esto es lo que tienes hoy", "Tu consulta, paciente por paciente", "Tus citas, servicios y disponibilidad"). No informan; ocupan la línea más valiosa de la pantalla.
3. Microcopy explicativo debajo de cada número ("Se calcula sobre citas completadas y ausencias; excluye canceladas y pendientes", "Registrados este mes en tu zona horaria", "Pagos acreditados en tu zona horaria"). Un dashboard de verdad muestra el número y el delta; la explicación va en un tooltip o no va.
4. Datos crudos del sistema expuestos al usuario: "America/Mexico_City", "(GMT-6)" repetido, fechas en formato largo con año ("lunes, 26 de octubre de 2026 09:00"). Se humaniza: "Ciudad de México", "mañana 9:00".
5. Demasiadas filas de control antes del contenido: en Agenda hay tabs + segmented Día/Semana + navegación de fecha + tira de días + chips de filtro + contadores = 5 bandas antes de la primera cita. Hay que fusionar y jerarquizar (una barra de herramientas compacta, filtros en un popover).
6. Pastillas y radios enormes en todo (tabs de 999px, cards de 24px, botones de 999px, inputs de 16px) mezclados sin regla. Un sistema tiene 2–3 radios y cada uno significa algo.
7. Un solo verde para todo: botón primario, íconos, badges, links, estado activo de nav, avatar. El acento pierde significado. El color de estado (confirmada, pendiente de pago, completada, cancelada) debe ser semántico y consistente en toda la app.
8. Aire sin intención: pantallas con 60% de vacío en móvil (wizard paso 1, agenda vacía) y a la vez cards apretadas. El espacio debe seguir una escala y una razón.
9. Estados vacíos como cajas centradas con un botón; skeletons que son rectángulos gigantes. Faltan ilustración mínima/ícono, texto corto y la acción correcta.
10. Tipografía sin escala: títulos de 28–32 px, cuerpo 16, labels 12, y entre medio nada; números sin tabular-nums; pesos solo 400/700. Falta contraste tipográfico real (display vs texto vs dato).
11. Íconos decorativos dentro de botones de texto ("📅 Agendar consulta", relojes y pins en cada línea) que agregan ruido, no información.
12. Header del panel igual en todas las páginas (logo + avatar) sin contexto de dónde estás; en desktop el sidebar y el contenido no comparten grilla ni alineación.

REFERENCIAS (estúdialas de verdad: abre las URLs, mira capturas, extrae reglas concretas; no copies marca, copia DISCIPLINA):
- Linear (linear.app): densidad, jerarquía tipográfica, una sola sombra, bordes de 1px a 6–8% de opacidad, radios de 6–8 px, color de acento usado con avaricia, toolbars compactas, estados vacíos con un ícono y una frase.
- Stripe Dashboard (dashboard.stripe.com; capturas públicas): KPIs como número grande + delta + sparkline, tablas con tabular-nums, secciones separadas por títulos y reglas, no por cards; paleta neutra con un acento.
- Cal.com (app.cal.com/<usuario> y su booking): referencia directa para /karla y el wizard: calendario mensual limpio, lista de horas en columna, resumen fijo a la izquierda en desktop, zona horaria como selector discreto, formulario corto.
- Notion Calendar (calendar.notion.so): vista de día/semana con bloques proporcionales, línea de "ahora", tipografía pequeña y legible, navegación de fecha mínima. Referencia para /app/agenda.
- Doctoralia (doctoralia.com.mx) y Zocdoc (zocdoc.com): cómo se presenta una profesional de salud (foto real grande, credenciales, reseñas verificadas con fecha, disponibilidad visible). Referencia de jerarquía para /karla, sin su saturación.
- Airbnb app de anfitrión y Mercado Pago app (México): patrones móviles que las nutriólogas ya conocen (bottom tab bar, hojas inferiores, listas con avatar + dos líneas + trailing).
- Headspace / Oura: calidez sin cursilería: tipografía serif de display en momentos clave, color de fondo cálido, ilustración mínima, mucho menos "card".
- Apple Human Interface Guidelines (developer.apple.com/design/human-interface-guidelines): tamaños táctiles 44 pt, tipografía dinámica, jerarquía de botones, hojas.
- Refactoring UI (Adam Wathan & Steve Schoger): las reglas de "no empieces por el color", "jerarquía por peso y tamaño, no por color", "usa menos bordes, más espacio", "labels secundarios en gris, no más pequeños", "alinea números a la derecha con tabular-nums".
- Dieter Rams / principios: "menos pero mejor". Cada elemento tiene que justificar su presencia.

SISTEMA VISUAL (impleméntalo en packages/ui/src/styles.css y en los componentes; es la única fuente de verdad):
- Grilla de 4 px. Escala de espacio: 4, 8, 12, 16, 24, 32, 48, 64. Nada fuera de la escala.
- Contenedores: móvil gutter 16; panel desktop contenido max 1120 con sidebar 240 y gutter 32; páginas públicas max 480 centradas (booking) y 560 (perfil) con gutter 20.
- Tipografía: Plus Jakarta Sans para UI (pesos 400/500/600), Instrument Serif SOLO para display de marketing y para el nombre de la nutri en su página pública (un uso, no decoración). Escala: 11 (caption, mono para labels de sistema), 13 (secundario), 15 (cuerpo), 17 (título de card/sección), 22 (título de página móvil), 28 (título de página desktop), 36–44 (display/KPI). Line-heights 1.2 display, 1.4 UI, 1.5 cuerpo. Números siempre con font-variant-numeric: tabular-nums.
- Radios: 6 px (inputs, botones, chips, badges), 12 px (cards, hojas, popovers), 999 px SOLO para avatares y el CTA primario de la página pública. Nada más.
- Bordes: 1 px color café al 8% (#2B2118 @ 8%) como separador principal. Sombra: una sola (0 1px 2px rgba(43,33,24,.06), 0 4px 12px rgba(43,33,24,.04)) y solo para elementos elevados (hojas, popovers, dropdown). Las cards en reposo NO llevan sombra.
- Superficies: fondo crema #FBF7F0; superficie principal blanca; superficie secundaria #F5F0E6 para agrupar; nunca más de dos niveles anidados. Regla: una sección = título + contenido sobre el fondo, separada por espacio (24–32) o por una regla de 1 px; una card solo cuando el bloque es una unidad accionable (una cita, un paciente, un servicio) o un KPI.
- Color: verde #4A7A2B exclusivamente para la acción primaria, links y el estado activo de navegación; miel #E8A93B para "requiere atención/pendiente de pago"; coral #D9644E para errores/destructivo; verde-estado #2F855A para confirmado/pagado; gris cálido #7A6E63 para completado/neutral. Define tokens semánticos --status-confirmed, --status-pending, --status-done, --status-cancelled y úsalos en Badge, Timeline y Semana. Los íconos van en el color del texto, no en verde.
- Iconografía: lucide a 16 px en UI densa y 20 px en nav; stroke 1.75; nunca ícono + texto dentro de un botón primario salvo flechas de dirección; nunca emoji.
- Botones: primario (verde sólido, texto blanco, 40 px alto en panel, 48 px en público/móvil), secundario (borde 1 px, fondo transparente), ghost (solo texto), destructivo. Un primario por vista. Tamaños táctiles ≥ 44 px en móvil.
- Formularios: label 13 px/500 arriba, input 40–44 px alto, radio 6, borde 1 px, focus ring de 2 px verde al 40%; error 13 px coral debajo; ayuda 13 px gris. Agrupar campos relacionados en una fila en desktop.
- Movimiento: 150–200 ms ease-out para hover/abrir; hojas 250 ms; respeta prefers-reduced-motion; nada de fade-up en cascada en cada elemento.
- Densidad: el panel es una herramienta de trabajo: filas de lista 56–64 px en móvil, 48 px en desktop; tablas con 12 px de padding vertical; sin cards de 24 px de padding para un dato de una línea.

ANATOMÍA POR PANTALLA (aplica el sistema; mantén la estructura decidida en ux-decisions.md):
- Shell del panel: desktop = sidebar 240 (logo arriba, nav con ícono 20 + label 15, ítem activo con fondo secundario y texto verde, usuario abajo con menú), contenido con un PageHeader único: título 28/600 + acciones a la derecha, SIN subtítulo salvo que diga algo útil (un dato, no un eslogan). Móvil = header 56 px con título de la sección (no el logo en todas las páginas) y acción contextual; tab bar 5 ítems, ícono 20 + label 11, activo en verde sin fondo pill.
- /app (dashboard): fila de 3–4 KPIs como número grande (36/600 tabular) + label 13 + delta vs mes anterior; nada de explicaciones debajo. Debajo, dos columnas en desktop (Hoy | Esta semana) como LISTAS con título de sección, no cards anidadas. El bloque "tu link" es una sola línea con botón copiar, no una card. Estado vacío: una línea + acción.
- /app/agenda: una toolbar de una sola fila: [‹ Hoy ›] [fecha corta] … [Día|Semana] [Filtros ⌄]. La tira de días va integrada debajo de la toolbar en móvil solo en vista Día. Timeline con horas a la izquierda en 11 px mono, bloques con borde izquierdo de 3 px en color de estado, nombre 15/600 y servicio 13 gris; huecos "Libre" como zona punteada discreta, no botones. Semana: grilla con líneas de 1 px al 8%, bloques sin texto largo, hoy resaltado en la cabecera.
- /app/pacientes: buscador + botón primario en la misma fila; filtros en chips pequeños (28 px) y aplicados en una línea; lista de filas (avatar iniciales 36, nombre 15/600, segunda línea 13 gris con última cita, trailing chevron). Ficha: cabecera con avatar 56, nombre 22, chips de datos, tabs 15, y contenido en secciones separadas por reglas.
- /app/cobros, /app/mi-pagina, /app/configuracion: misma anatomía de secciones; configuración como lista de filas (label + valor + chevron / switch), no formularios gigantes abiertos.
- /karla (público): hero compacto: avatar 96 (foto real cuando exista; iniciales con fondo secundario, no verde sólido), nombre en Instrument Serif 32, una línea de credencial 13 gris (cédula · ciudad), prueba social como una línea con estrellas pequeñas; CTA primario 52 px; "Próximo horario: mañana 9:00" en 13 debajo; servicios como lista de filas con precio alineado a la derecha en tabular; reseñas como citas con comillas tipográficas, nombre y fecha corta; links sociales como fila de íconos al final; footer de 11 px. El tema por nutri cambia acento y fondo, no la estructura.
- /karla/agendar (wizard): header compacto con nombre y paso actual; stepper como línea de progreso fina + texto "Paso 2 de 4 · Fecha", no 4 círculos numerados grandes; quita la caja redundante "Elige tu consulta" encima del título; opciones de servicio como filas con radio a la izquierda, precio a la derecha, descripción 13; calendario mensual estilo Cal.com (días disponibles con peso 600, no disponibles al 35%, seleccionado relleno verde); horas en grilla de 3 columnas de 44 px; paso 4 formulario corto; barra inferior fija con Atrás (ghost) y Continuar (primario) y el resumen "Primera consulta · mar 27 · 10:30 · $800" en 13 encima. En desktop, dos columnas: resumen fijo a la izquierda (320) y el paso a la derecha.
- /login, /registro, /cita/<token>, /resena/<token>: tarjeta única centrada max 400, logo pequeño, título 22, campos, primario; sin ilustración, sin relleno.

COPY (aplica en toda la UI; español MX, directo):
- Elimina subtítulos de relleno. Si un título necesita contexto, que sea un dato: "Agenda · 3 citas hoy".
- Nada de explicar cómo se calcula un número en la UI; si hace falta, tooltip con ícono de info.
- Fechas: "hoy 10:30", "mañana 9:00", "mar 27 oct", "27 oct 2026" solo cuando el año importa. Zonas: "Ciudad de México", nunca identificadores IANA; el selector de zona solo aparece donde el paciente puede cambiarla.
- Dinero: "$800" (sin .00 cuando es entero), "MXN" solo una vez por vista o en tooltip.
- Botones con verbo + objeto cuando el contexto no es obvio ("Confirmar cita"), solo verbo cuando lo es ("Guardar").

ENTREGABLES
1. packages/ui: tokens y componentes actualizados al sistema (Button, Input/FormField, Card, Badge con variantes de estado, Tabs, SegmentedControl compacto, FilterChip 28 px, Sheet, Dialog, EmptyState con ícono, Skeleton con formas realistas de fila/KPI, Avatar, PageHeader, Toolbar, SectionHeader, DataList/Row, KPI). Documenta cada token y cuándo usar card vs sección en packages/ui/README.md ("Sistema visual").
2. Página /dev/ui (solo en desarrollo, bloqueada en producción) que renderiza todos los primitivos y tokens: es tu herramienta y la del equipo para ver consistencia de un vistazo.
3. Las 12 pantallas listadas rediseñadas con el sistema, respetando docs/ux-decisions.md.
4. Auditoría "AI smell" al final (lista en docs/ux-audit.md, sección nueva "Rediseño visual"): para cada pantalla, los 12 síntomas de arriba marcados como corregidos con el archivo tocado.
5. Capturas "antes/después" móvil y desktop de las 12 pantallas en docs/ux-captures/rediseno/ y pegadas en el PR lado a lado.
6. Tests: los primitivos nuevos/modificados con tests de render y ARIA; E2E existentes en verde (ajusta selectores si cambiaste markup, no el flujo). Agrega una prueba de contraste automática (axe en Playwright o similar) en /karla, /karla/agendar y /app: cero violaciones de contraste.
7. docs/adr/<siguiente>-sistema-visual.md con las decisiones (radios, sombra única, card vs sección, paleta semántica de estados).

CÓMO TRABAJAR
- Primero tokens y primitivos; luego el shell del panel; luego pantalla por pantalla en este orden: /karla, wizard, dashboard, agenda, pacientes, resto. Un commit por pantalla con su captura.
- Antes de dar por terminada cada pantalla, pásale esta lista: ¿hay más de un botón primario? ¿hay alguna card que podría ser una sección? ¿hay texto que explica en vez de mostrar? ¿hay un dato crudo del sistema? ¿todos los radios están en {6,12,999}? ¿los números son tabular? ¿se ve bien a 390 y a 1280? ¿se parece a Linear/Cal.com/Stripe en disciplina, no en marca?
- No cambies server actions, schema, migraciones, rutas, nombres de eventos ni el contrato de los componentes que usan datos; si necesitas un dato nuevo para la UI (p. ej. delta mensual en KPIs), calcúlalo en la capa de lectura existente (lib/dashboard.ts) con cambio mínimo y test.

Terminado significa: pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm e2e && pnpm --filter @granola/web exec next build en verde (docker-compose -f docker-compose.local.yml up -d antes), capturas antes/después en el PR, commits chicos en español, git push -u origin feature/diseno y gh pr create --fill con resumen, la auditoría y qué quedó fuera.
```

---

## Orden (actualizado)

| Tanda | Worktrees | Nota |
|---|---|---|
| Ahora | `inbody`, `importador`, `post-integracion` | en paralelo |
| Después | `logs` | solo |
| Al final | `diseno` | solo: toca toda la UI, va cuando no haya otros PRs de UI abiertos |
