# AGENTS.md — Granola (para Codex, Claude o cualquier agente)

Empieza por aquí, en este orden:

1. `docs/granola-overview.html` — resumen visual: PRD → RFC → ADR, estado actual. Ábrelo en el navegador.
2. `PLAN.md` — plan maestro: fases, prioridades, modelo de datos, flujo estrella.
3. `CLAUDE.md` — reglas duras del repo (aplican a todos los agentes, no solo Claude).
4. `docs/adr/` — decisiones tomadas y por qué. Si vas a cambiar una, escribe un ADR nuevo.
5. `packages/*/README.md` y `docs/whatsapp-plantillas.md` — detalle por paquete.

## Reglas resumidas

- Datos de salud **nunca** llegan al cliente sin pasar por la API; toda query filtra por `nutritionist_id` de la sesión.
- `packages/core` es lógica pura sin IO, con tests.
- Webhooks idempotentes (Stripe, Mercado Pago, WhatsApp).
- Dinero en centavos, fechas en UTC, zona horaria aparte.
- Sin `any`; zod en toda frontera.
- UI en español MX; código en inglés.

## Verificación antes de dar algo por terminado

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @granola/web exec next build
```

## Dev

```bash
pnpm --filter @granola/web exec next dev -p 3100
```

Sin `DATABASE_URL` en `apps/web/.env.local` las páginas con datos fallan en runtime (esperado); todo lo demás compila.

## Qué sigue (al 24 oct 2026)

- Cerrar huecos de F1 (ver sección 4 del overview).
- F2: pacientes, expediente, antropometría, notas IA. Ver `PLAN.md` sección 6.
