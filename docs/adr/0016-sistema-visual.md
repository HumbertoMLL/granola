# ADR 0016 — Sistema visual con jerarquía y densidad

Fecha: 2026-10-25 · Estado: aceptado para implementación según el encargo de rediseño visual.

## Contexto

La identidad cálida del ADR 0003 se conserva. Los patrones y estructuras del ADR 0014 y `docs/ux-decisions.md` también. La interfaz anterior aplicaba la misma card, radios grandes, sombra y acento a demasiados elementos, por lo que títulos, métricas, navegación y estados competían entre sí.

## Decisión

`packages/ui/src/styles.css` concentra el sistema y sus alias Tailwind. Jakarta usa 400/500/600; Instrument Serif se limita al display de marketing y al nombre público. La escala tipográfica es 11/13/15/17/22/28/36/44, con números tabulares. Espaciado en 4/8/12/16/24/32/48/64; los contenedores conservan el gutter público explícito de 20.

Los controles tienen radio de 6 px; las superficies, hojas y popovers, 12 px. Solo avatares y el CTA principal público usan 999 px. Los alias de radios anteriores apuntan a 6 o 12, de modo que la migración de presentación no rompe componentes consumidores.

Hay una sola elevación: `0 1px 2px rgba(43,33,24,.06), 0 4px 12px rgba(43,33,24,.04)`. Se reserva a superficies elevadas. Las cards en reposo no llevan sombra. Las secciones se construyen con título y contenido separados por espacio o una regla de tinta al 8%. La card representa una unidad accionable o un KPI; no es el contenedor automático de cada bloque.

El primario `#4A7A2B` se reserva a acciones, enlaces y navegación activa. Los estados son `confirmed` (`#2F855A`), `pending` (`#E8A93B`), `done` (`#7A6E63`) y `cancelled` (`#D9644E`), compartidos por Badge y calendario. Cada estado tiene superficie y tinta propias. Coral/blanco da 3.57:1 y gris/superficie secundaria 4.36:1; se mantienen los colores semánticos pedidos y se añaden tintas oscuras accesibles para texto pequeño. El destructivo sólido usa `#AC4334` con blanco (5.82:1).

Los nuevos PageHeader, Toolbar, SectionHeader, DataList/DataRow y KPI expresan estas jerarquías sin acoplarse a datos. EmptyState usa icono y texto corto; SkeletonRow/KPI reproducen el contenido esperado. Tabs, selección única y filtros mantienen su semántica. Stepper cambia a línea y nombre del paso conservando la lista accesible.

`/dev/ui` reúne tokens y primitivos en desarrollo y responde 404 en producción. Las transiciones duran 150–200 ms, las hojas 250 ms; reduced motion elimina animación perceptible. No hay entrada en cascada.

## Consecuencias

No cambian acciones del servidor, schema, contratos de datos, reservas, pagos ni autorización. Los consumidores reciben componentes y tokens de presentación compatibles. Las pruebas de render/ARIA cubren las nuevas jerarquías y las interacciones de formularios, Tabs y confirmaciones. Las capturas antes/después y la comprobación automática de contraste verifican el resultado en móvil y desktop.

Esta decisión afecta presentación y no añade servicios, dependencias ni estado persistente: mantiene Twelve-Factor sin cambios de configuración o despliegue.
