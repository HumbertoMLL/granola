# ADR 0002 — WhatsApp Cloud API directo; MVP con número de Granola

**Fecha:** 2026-10-24 · **Estado:** propuesto

## Contexto
Feature prioritaria: al agendar, el paciente recibe confirmación y recordatorios por WhatsApp. Avena solo lo ofrece en Premium ($999 MXN).

## Decisión
- Integración directa con **Meta WhatsApp Cloud API** (sin Twilio/360dialog).
- **MVP:** un número de Granola envía plantillas *utility* en nombre del nutri ("Tu cita con {{nutri}}…").
- **F2:** Embedded Signup para que cada nutri conecte su propio número (Granola como Tech Provider).
- Todo envío pasa por `packages/whatsapp` y se registra en `wa_messages`.

## Plantillas iniciales
`cita_confirmada`, `recordatorio_24h`, `recordatorio_2h`, `cita_cancelada`, `cita_reagendada`, `pago_pendiente_oxxo`, `pide_resena`, `nueva_cita_nutri`.

## Consecuencias
- Hay que crear Meta Business + app + verificar número **ya** (la aprobación tarda días).
- Costo por conversación utility en MX ≈ USD 0.01–0.02; se absorbe en el plan.
- Con número compartido, el paciente ve "Granola", no al nutri. Aceptable para MVP; se resuelve en F2.
