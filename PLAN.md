# GRANOLA — Plan maestro

> Clon de Avena (avena.io) para nutriólogos. Web-first, pensado como web app (PWA) con app nativa después.
> Fecha: 24 oct 2026. Fuentes: `docs/research/` (3 investigaciones: radiografía de Avena, ronda 2 hate/cobros/geografía, caso contra Supabase).

---

## 0. Tesis en una línea

**"La app que tus pacientes sí usan, y la agenda que te llena la consulta."**
Avena gana en contenido (30K recetas SMAE) y pierde en: app de paciente rígida y con bugs, cobros a pacientes con 10% de comisión y solo tarjeta, cero WhatsApp real fuera de Premium, reputación inflada y precio que escala por paciente. Granola entra por el lado del **negocio del nutriólogo** (página pública + agenda + cobro + WhatsApp) y después construye lo clínico.

Los dos fundadores de Avena dicen lo mismo en entrevistas: el valor no es la IA, es retener al paciente y hacer crecer el negocio del nutriólogo. Ese es el centro de Granola.

---

## 1. Qué construimos primero (prioridad de funciones)

Orden por lo que tú pediste + lo que la investigación dice que duele:

| # | Feature | Por qué va primero | Fase |
|---|---------|-------------------|------|
| 1 | **Página pública tipo link-tree** (`granola.app/@slug`): foto, bio, links, servicios, botón "Agendar", reseñas verificadas | Es el gancho product-led: el nutriólogo la comparte en IG/TikTok y trae pacientes. Avena la tiene pero fea y sin links libres | F1 |
| 2 | **Agenda + reservas** : servicios (duración, precio, presencial/online), disponibilidad semanal, excepciones, buffer, zona horaria, sync Google Calendar, Meet/Zoom link | Lo que el nutriólogo paga con gusto: más consultas. Avena depende de Calendly | F1 |
| 3 | **WhatsApp (Meta Cloud API)**: confirmación al agendar, recordatorio 24h y 2h, link para reagendar/cancelar, aviso al nutriólogo | Tu pedido explícito. Avena lo cobra en Premium ($999). Pacientes mexicanos viven en WhatsApp | F1 |
| 4 | **Cobro en la reserva**: tarjeta (Stripe), SPEI/OXXO (Mercado Pago), pago en consulta, paquetes de N consultas. **Comisión 0%** (vs 10% Avena) | Hueco confirmado: nadie da OXXO/SPEI al paciente del nutriólogo | F1 |
| 5 | Pacientes + expediente + antropometría (ISAK básico, OMS) + cálculo de requerimientos | Base de la consulta | F2 |
| 6 | Notas IA por grabación de consulta + lectura de labs/InBody PDF | Paridad con Avena/HeyNutre; vendible suelta | F2 |
| 7 | Motor de planes por equivalentes SMAE + plantillas + PDF con marca | El core de Avena; aquí hay que igualar | F3 |
| 8 | Recetas (1–2K validadas, etiquetadas, marcadas "revisada por nutrióloga") | Contenido = moat; empezar con menos pero mejor | F3 |
| 9 | **App paciente (PWA)**: menú del día, intercambio libre, "comí fuera", registro con foto, lista del súper por pasillo compartible por WhatsApp, kcal visibles si el nutri lo permite, offline-first | Dolor #1 de Avena (57 quejas de rigidez, 37 de bugs, 36 de lista/PDF) | F4 |
| 10 | Plan por WhatsApp sin app (link mágico) | Pacientes que no instalan apps | F4 |
| 11 | CFDI automático al paciente (PAC), retos grupales, marketplace | Monetización extra | F5 |
| 12 | Expo (iOS/Android) reutilizando `packages/core` y la API | Cuando la PWA pruebe el flujo | F5 |
| 13 | LATAM fuera de MX (Perú, Colombia, Ecuador, Centroamérica) con bases de alimentos locales | Avena no anuncia ahí; Argentina 3.6★ | F6 |

**Lo que NO hacemos al inicio:** IA generativa de planes/recetas (commodity, y Avena ya recibe hate por recetas IA malas), retos, marketplace, suplementos, directorio SEO masivo.

---

## 2. Stack y arquitectura (decisiones)

Decisiones tomadas con base en `docs/research/supabase-en-contra.txt`. Si no estás de acuerdo con alguna, es el momento de decirlo.

| Capa | Elección | Por qué | Alternativa descartada |
|------|----------|---------|------------------------|
| Monorepo | **pnpm workspaces + Turborepo** | Web hoy, Expo mañana, lógica compartida en `packages/` | Repo único Next (no escala a mobile) |
| Web | **Next.js 16 App Router, Tailwind v4, shadcn/ui** | Ya lo dominas (IA Sin Bullshit). Vercel | — |
| DB | **Postgres en Neon** (Launch → Scale) | Portable (pg_dump a RDS mx-central-1 cuando haya clínicas), restore instantáneo, $20–93/mes a 100–10K pacientes | Supabase BaaS: RLS desde cliente = la causa de 16K bases expuestas; 152 incidentes en 2026; soporte Pro sin SLA; HIPAA $599+ |
| ORM | **Drizzle** | Tipado, migraciones SQL legibles, ligero en serverless | Prisma (más pesado en edge) |
| Auth | **Better Auth** (en nuestro Postgres) | MIT, portable, plugin Expo, magic link + Google. Los pacientes NO tienen password: entran por link mágico / OTP WhatsApp | Supabase Auth (lock-in), Clerk ($25 + datos de pacientes en tercero) |
| Autorización | **En la API, nunca en el cliente.** Tablas clínicas solo accesibles vía server actions / route handlers con `nutritionist_id` del session | RLS como única barrera |
| Archivos | **S3-compatible (Cloudflare R2)** con URLs firmadas | Barato, sin egress, portable | Supabase Storage |
| Jobs / recordatorios | **Inngest** (funciones durables, retries, cron, `sleepUntil`) | Recordatorio "24h antes" es un `sleepUntil` con cancelación si reagendan. Portable (self-host posible) | pg_cron/Edge Functions (lock-in), Vercel Cron solo |
| WhatsApp | **Meta WhatsApp Cloud API** directo. MVP: número de Granola con plantillas aprobadas. F2: Embedded Signup para que cada nutri conecte su propio número | Sin intermediario (Twilio cobra doble) | Twilio, 360dialog |
| Calendario | Google Calendar API (OAuth, free/busy + crear eventos con Meet) | Nutris ya viven en Google | Calendly embebido |
| Pagos tarjeta | **Stripe Connect (Express)** — ya lo conoces; el nutri cobra en su cuenta, Granola 0% application fee | — |
| Pagos SPEI/OXXO | **Mercado Pago** (Checkout Pro / Bricks) | SPEI y OXXO al paciente, común en MX | Conekta (válido, ver F1), Stripe OXXO (solo pago único, sin SPEI) |
| Email | Resend | Transaccional | — |
| IA (F2+) | Claude API (`claude-sonnet-5-5`) con salida estructurada; transcripción Whisper/Deepgram | Notas, labs. Nunca genera planes sin revisión | — |
| Analítica | PostHog (como Avena) | Producto + funnels | — |
| Errores | Sentry | — | — |
| Deploy | Vercel (web) + Neon + Inngest Cloud + R2 | Todo con free tier para arrancar | — |

**Principio de seguridad (LFPDPPP 2025):** datos de salud son sensibles. Consentimiento expreso del paciente al crear expediente (checkbox + timestamp + IP), aviso de privacidad, cifrado en reposo (Neon lo da), bitácora de accesos (`audit_log`), borrado a petición. Nada clínico sale al cliente sin pasar por la API.

---

## 3. Estructura del repo

```
granola/
├── apps/
│   ├── web/                    # Next.js 16 — panel nutri + páginas públicas + API
│   │   └── src/app/
│   │       ├── (marketing)/    # landing, precios, blog
│   │       ├── (auth)/         # login, registro, magic link
│   │       ├── (panel)/app/    # dashboard, agenda, pacientes, cobros, mi-pagina, config
│   │       ├── [slug]/         # página pública del nutri (link-tree) + /agendar
│   │       ├── p/[token]/      # vista de paciente por link mágico
│   │       └── api/
│   │           ├── webhooks/{stripe,mercadopago,whatsapp}/
│   │           ├── inngest/
│   │           └── auth/[...all]/
│   └── mobile/                 # Expo (F5) — placeholder
├── packages/
│   ├── db/                     # Drizzle schema + migraciones + client
│   ├── auth/                   # Better Auth config compartida (server + client)
│   ├── core/                   # Lógica de dominio pura (sin IO)
│   │   ├── scheduling/         # slots, disponibilidad, buffers, zonas horarias
│   │   ├── smae/               # equivalentes, grupos, distribución (F3)
│   │   └── nutrition/          # requerimientos, IMC, ISAK, OMS (F2)
│   ├── whatsapp/               # cliente Cloud API, plantillas, parser de webhooks
│   ├── payments/               # adaptadores Stripe Connect y Mercado Pago
│   ├── jobs/                   # funciones Inngest (recordatorios, sync calendar)
│   ├── ui/                     # design system Granola (tokens, componentes shadcn)
│   └── config/                 # eslint, tsconfig compartidos
├── docs/
│   ├── research/               # las 3 investigaciones (html + txt)
│   └── adr/                    # decisiones de arquitectura (1 archivo por decisión)
├── scripts/                    # seeds, importadores (SMAE, Avena CSV)
├── PLAN.md                     # este archivo
├── CLAUDE.md                   # reglas para agentes
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 4. Modelo de datos (F1)

```
users                 ← Better Auth (id, email, name, image)
nutritionists         user_id, slug, display_name, bio, avatar_url, cedula, phone_wa,
                      timezone, theme(json), links(json[]), plan, stripe_account_id,
                      mp_user_id, google_refresh_token(enc), onboarding_step
services              nutritionist_id, name, description, duration_min, price_cents,
                      currency, modality(online|presencial|ambas), location, is_active,
                      payment_mode(prepaid|at_visit|optional), package_sessions
availability_rules    nutritionist_id, weekday, start_time, end_time
availability_overrides nutritionist_id, date, start_time?, end_time?, is_blocked
patients              nutritionist_id, name, phone_wa, email, birth_date, sex, notes,
                      consent_at, consent_ip, source(booking|manual|import)
appointments          nutritionist_id, patient_id, service_id, starts_at, ends_at,
                      status(pending_payment|confirmed|cancelled|no_show|completed),
                      modality, meet_url, google_event_id, cancel_token,
                      reminder_24h_sent_at, reminder_2h_sent_at
payments              appointment_id, provider(stripe|mercadopago|cash), provider_ref,
                      amount_cents, currency, status, method(card|spei|oxxo|cash), paid_at
wa_messages           nutritionist_id, patient_id?, direction, template, wa_message_id,
                      status(sent|delivered|read|failed), payload(json)
reviews               nutritionist_id, patient_id, appointment_id, rating, text,
                      is_public, verified=true (solo tras cita completada)
audit_log             actor_id, action, entity, entity_id, ip, at
```

F2+: `records`, `measurements`, `lab_results`, `consult_notes`, `foods`, `food_groups`, `equivalents`, `recipes`, `meal_plans`, `meal_plan_days`, `grocery_lists`.

---

## 5. Flujo estrella (F1): "alguien agenda → le llega el WhatsApp"

```
Paciente abre granola.app/@karla
 → elige servicio → ve slots (core/scheduling: reglas − overrides − citas − Google busy)
 → nombre + WhatsApp (+ email opcional) + consentimiento
 → si el servicio es prepagado: Stripe (tarjeta) o Mercado Pago (SPEI/OXXO)
    · webhook confirma → appointment.status = confirmed
    · OXXO/SPEI pendiente → status pending_payment, expira en 24h (Inngest)
 → se crea evento en Google Calendar del nutri con link Meet
 → Inngest `appointment/confirmed`:
    · WhatsApp plantilla `cita_confirmada` al paciente (hora, modalidad, link, botón "Reagendar")
    · WhatsApp al nutri "Nueva cita: Karla, mañana 10:00"
    · sleepUntil(starts_at − 24h) → plantilla `recordatorio_24h` con botones Confirmo / Reagendar
    · sleepUntil(starts_at − 2h) → `recordatorio_2h`
    · si reagendan/cancelan → cancelOn `appointment/changed`
 → post-cita (+2h) → WhatsApp "¿Cómo te fue? Deja tu reseña" → review verificada en la página pública
```

Plantillas WhatsApp a registrar en Meta (categoría *utility*): `cita_confirmada`, `recordatorio_24h`, `recordatorio_2h`, `cita_cancelada`, `cita_reagendada`, `pago_pendiente_oxxo`, `pide_resena`, `nueva_cita_nutri`.

---

## 6. Fases y tiempos

| Fase | Semanas | Entregable | Agentes en paralelo |
|------|---------|-----------|---------------------|
| **F0 Fundamentos** | 1 | Monorepo corriendo, Neon + Drizzle + Better Auth, design system Granola, layout del panel, deploy en Vercel, CI | A infra+db, B design system+shell |
| **F1 Negocio** | 2–4 | Link-tree + agenda + reservas + WhatsApp + cobros. **Vendible.** | C scheduling core+booking UI, D whatsapp, E payments, F editor de página pública, G Google Calendar |
| **F2 Consulta** | 5–8 | Pacientes, expediente, antropometría, notas IA, labs PDF | H expediente, I nutrition core, J IA notas |
| **F3 Planes** | 9–14 | Motor SMAE, plantillas, recetas, PDF con marca | K smae core, L editor de plan, M recetas+seed, N PDF |
| **F4 Paciente** | 15–20 | PWA paciente offline-first, plan por WhatsApp, lista del súper | O PWA, P sync, Q WA delivery |
| **F5 Monetiza** | 21+ | CFDI, paquetes, retos, Expo | — |

**Regla:** cada agente trabaja en su `package/` o su ruta; `packages/core` no importa nada con IO (testeable puro). Contratos (tipos de Drizzle + zod) se definen en F0 antes de paralelizar.

---

## 7. Diferenciadores que se comunican desde el día 1

1. **0% de comisión** en cobros a pacientes (Avena: 10% + Stripe).
2. **SPEI y OXXO** para el paciente, no solo tarjeta.
3. **WhatsApp en todos los planes**, no solo Premium.
4. **Reseñas verificadas** (solo tras cita completada, no obligatorias 5★).
5. **Precio claro, prueba real de 14 días, cancelación en 1 clic.** Sin contador falso.
6. **Precio plano por nutriólogo**, sin tope de pacientes activos (o tope muy alto).

Pricing tentativo: Starter $249 MXN (agenda + página + WA + cobros), Pro $499 (expediente + planes + app paciente), Clínica $999 (multi-nutri, CFDI). Anual −20%.

---

## 8. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Aprobación de WhatsApp Business / plantillas tarda días | Empezar el registro en Meta Business **esta semana**; usar número de Granola; plantillas utility se aprueban rápido |
| Mercado Pago onboarding de cada nutri (OAuth marketplace) | Arrancar con Stripe Connect; MP en F1.5 con cuenta de Granola + split |
| 30K recetas de Avena no se replican | F3 con 1–2K curadas; IA genera borrador, nutrióloga valida, etiqueta "verificada" |
| Datos de salud sin cuidado | Autorización en API, audit_log, consentimiento, Neon cifrado, sin anon key |
| Scope creep | F1 vendible antes de tocar lo clínico |
| Neon scale-to-zero agrega latencia | Launch plan con compute mínimo siempre encendido |

---

## 9. Decisiones que necesito de ti

1. **Nombre/dominio**: `granola.app`, `granola.mx`, `usagranola.com`? (Checo disponibilidad cuando digas.)
2. **Neon vs Supabase**: la investigación dice Neon + Better Auth. Tienes Supabase MCP conectado — ¿lo descartamos de plano?
3. **Número de WhatsApp**: MVP con número de Granola (rápido) o desde el inicio cada nutri conecta el suyo (Embedded Signup, más chamba)? Recomiendo Granola primero.
4. **SPEI/OXXO**: Mercado Pago vs Conekta. Recomiendo MP.
5. **Marca visual**: ¿nuevo design system cálido/claro (avena, miel, verde) o reciclar el dark de IA Sin Bullshit? Recomiendo nuevo: es B2B salud, se ve en consultorio.
6. **Primer nicho**: nutriólogas jóvenes de consulta online con IG/TikTok (las que más comparten link-tree) vs bariatría/GLP-1. Recomiendo el primero.
7. **¿Arranco F0 ya con agentes en paralelo** (infra+db+auth y design system+shell)?
