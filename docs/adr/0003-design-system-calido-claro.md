# ADR 0003 — Design system propio, cálido y claro

**Fecha:** 2026-10-24 · **Estado:** aceptado (Beto, 24 oct 2026)

## Decisión
Granola tiene su propio design system en `packages/ui`, **paleta cálida y clara** (crema/avena, café oscuro, verde hoja, miel), muy distinta al dark theme de IA Sin Bullshit. Mobile-first.

## Razones
- Público: nutriólogas jóvenes de consulta online; el panel se usa en el celular durante la consulta y se enseña al paciente.
- Producto de salud B2B: debe sentirse confiable y cálido, no "tech dark".
- Separar marcas evita confundir la pauta activa de IA Sin Bullshit con Granola.

## Consecuencias
- Tokens semánticos con `@theme` de Tailwind v4; componentes estilo shadcn propios.
- Dark mode opcional, no prioritario.
