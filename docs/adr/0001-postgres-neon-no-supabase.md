# ADR 0001 — Postgres en Neon + Better Auth, no Supabase como BaaS

**Fecha:** 2026-10-24 · **Estado:** propuesto (pendiente OK de Beto)

## Contexto
Datos de salud de pacientes (LFPDPPP 2025: sensibles). Posible migración futura a AWS mx-central-1 o mercado EE.UU. (HIPAA). Ver `docs/research/supabase-en-contra.txt`.

## Decisión
- Postgres administrado en **Neon** (Launch), Drizzle ORM.
- **Better Auth** en nuestra propia base. Pacientes sin password (magic link / OTP WhatsApp).
- Autorización en la API de Next.js, **no RLS expuesto al cliente**.
- Archivos en R2, jobs en Inngest, nada de Edge Functions ni Realtime de terceros.

## Razones
- RLS desde cliente fue la causa de ~16,000 bases Supabase con datos personales expuestos (UpGuard, sep 2026).
- 152 incidentes en status.supabase.com en 2026 (vs 98 en 2025); soporte Pro sin SLA (clínica 12h caída sin respuesta).
- HIPAA en Supabase desde $599/mes + add-on; Neon Scale y RDS lo dan sin costo extra.
- Costo a 10K pacientes es < $0.01/paciente/mes en cualquier opción: el precio no decide, decide portabilidad y riesgo.
- Salir de Neon = `pg_dump`. Salir de Supabase Auth + RLS + Edge = reescribir.

## Consecuencias
- Ensamblamos auth + storage + jobs a mano (~2 días más en F0).
- Más control y cero lock-in. Si algún día se quiere Supabase, solo como Postgres + Auth, sin Data API.
