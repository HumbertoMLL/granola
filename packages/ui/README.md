# @granola/ui

Design system de Granola. Usar los tokens semánticos de `src/styles.css`; no definir otra paleta ni radios para estos patrones.

| Componente                         | Cuándo usarlo                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SegmentedControl                   | Una sola opción entre pocas: modalidad, pago, Día/Semana. Radios nativos dentro de radiogroup con nombre accesible; flechas y Tab nativos.                                                                                                 |
| FilterChip                         | Facetas opcionales combinables; toggle con aria-pressed.                                                                                                                                                                                   |
| AppliedFilters                     | Siempre junto a filtros de listas: chips removibles, contador vivo y Limpiar todo.                                                                                                                                                         |
| Stepper                            | Flujo con pantallas consecutivas. currentStep basado en cero, aria-current=step.                                                                                                                                                           |
| Sheet + SheetContent side="bottom" | BottomSheet: reutilizamos la hoja existente (Radix Dialog), con foco atrapado/restaurado, Escape, overlay, título y descripción accesibles. No duplicar este primitivo.                                                                    |
| Timeline                           | Agenda del día: minutos civiles en la zona mostrada, bloques proporcionales, huecos reales de disponibilidad como botones y línea de ahora. El consumidor calcula la disponibilidad; no convertir todo espacio vacío en tiempo reservable. |
| EmptyState                         | Lista sin datos: icono, título corto y acción; descripción opcional. Durante la carga usar Skeleton.                                                                                                                                       |
| Tabs                               | Citas / Servicios / Disponibilidad: navegación interna con tablist, paneles y teclado.                                                                                                                                                     |

## Reglas obligatorias (copia de docs/ux-decisions.md)

1. **Checkbox** solo para elegir varias opciones o aceptar algo (consentimiento). Nunca como decoración ni como ícono.
2. **Radio / segmented control** para elegir una sola opción entre pocas (modalidad online/presencial, método de pago, Día/Semana). No usar chips que parecen filtros para una elección obligatoria.
3. **Chips de filtro** son botones toggle (`aria-pressed`), nunca checkboxes dibujados. Al activarse, se reflejan en la fila de aplicados con ×.
4. **Tab bar inferior** = navegación: ícono (lucide) + etiqueta, estado activo por color/peso, nunca cuadros. Máximo 5 ítems.
5. **Tabs internos** (Citas · Servicios · Disponibilidad) = componente Tabs con `role="tablist"`, no botones sueltos.
6. **Listas** son listas (`ul/li` o tabla cuando hay columnas comparables), con la acción principal al final de la fila y las secundarias en un menú "⋯", no 4 botones por fila.
7. **Botón primario único por pantalla** (el que resuelve la tarea), secundarios con borde, destructivos en coral y con confirmación.
8. **Hojas inferiores (Sheet)** para detalle/acciones contextuales en móvil; **Dialog** solo para confirmaciones.
9. **Formularios**: label visible arriba del input, error debajo en coral, ayuda en muted; WhatsApp con prefijo +52 fijo; nunca placeholder como label.
10. **Estados vacíos y de carga** siempre: Skeleton mientras carga, mensaje + acción cuando no hay datos.
11. **Zona del pulgar**: acciones principales en el tercio inferior en móvil; nada crítico solo en la esquina superior.
12. **Texto**: español MX, tono directo, sin mayúsculas sostenidas salvo labels mono de 11–12 px.

## Verificación

`pnpm --filter @granola/ui test` verifica render, atributos accesibles, selección, filtros, geometría y foco de Sheet.

## Sistema visual

Fuente única: `src/styles.css` ([ADR 0017](../../docs/adr/0017-sistema-visual.md)). Plus Jakarta Sans usa pesos 400, 500 y 600. Instrument Serif se reserva al display de marketing y al nombre del perfil público; no se usa en títulos del panel. Los números heredan `tabular-nums`.

### Tokens

| Tokens                                                                                 | Valor y uso                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `--background` / `--foreground`                                                        | `#FBF7F0` / `#2B2118`: fondo crema y tinta principal.                                                                                           |
| `--card`, `--card-foreground`                                                          | Blanco / tinta principal: unidad accionable o KPI.                                                                                              |
| `--popover`, `--popover-foreground`                                                    | Blanco / tinta principal: superficie elevada.                                                                                                   |
| `--secondary`, `--secondary-foreground`                                                | `#F5F0E6` / tinta principal: agrupar campos o destacar una fila.                                                                                |
| `--muted`, `--muted-foreground`                                                        | Superficie secundaria / `#74685E`: texto secundario que conserva AA en las tres superficies.                                                    |
| `--border`, `--input`                                                                  | `rgb(43 33 24 / 8%)`: divisores y bordes de controles.                                                                                          |
| `--primary`, `--primary-hover`, `--primary-foreground`                                 | `#4A7A2B`, `#3E6723`, blanco: acción primaria, enlace o navegación activa.                                                                      |
| `--primary-soft`, `--ring`                                                             | `#E9F2E0` / primario: selección y foco al 40%.                                                                                                  |
| `--accent`, `--accent-foreground`, `--accent-soft`                                     | `#E8A93B` / tinta principal / `#FBEFD6`: atención. Nunca miel como texto pequeño sobre blanco.                                                  |
| `--status-confirmed`, `--status-confirmed-soft`, `--status-confirmed-foreground`       | `#2F855A`, `#E8F3ED`, `#266C49`: confirmada o pagada.                                                                                           |
| `--status-pending`, `--status-pending-soft`, `--status-pending-foreground`             | `#E8A93B`, `#FBEFD6`, `#80520B`: requiere atención o pago.                                                                                      |
| `--status-done`, `--status-done-soft`, `--status-done-foreground`                      | `#7A6E63`, `#F5F0E6`, `#665C53`: completada o neutral.                                                                                          |
| `--status-cancelled`, `--status-cancelled-soft`, `--status-cancelled-foreground`       | `#D9644E`, `#FBE6E1`, `#AC4334`: cancelada.                                                                                                     |
| `--destructive`, `--destructive-ink`, `--destructive-foreground`, `--destructive-soft` | Coral, `#AC4334`, blanco y `#FBE6E1`. Texto de error y fondo de botón destructivo usan la tinta oscura para cumplir AA.                         |
| `--success`, `--warning`                                                               | Alias compatibles de confirmado y pendiente. No sustituyen los estados explícitos.                                                              |
| `--radius`, `--radius-surface`                                                         | 12 px: cards, hojas, diálogos y popovers.                                                                                                       |
| `--radius-control`                                                                     | 6 px: botón, input, badge, chip y segmentos.                                                                                                    |
| `--radius-avatar`                                                                      | 999 px: avatares y CTA principal del perfil público.                                                                                            |
| `--radius-sm`, `--radius-md`                                                           | Alias de 6 px para utilidades existentes.                                                                                                       |
| `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-3xl`                           | Alias de 12 px; no representan una escala adicional.                                                                                            |
| `--elevation`, `--shadow-soft`, `--shadow-float`                                       | Una sombra: `0 1px 2px rgba(43,33,24,.06), 0 4px 12px rgba(43,33,24,.04)`. Alias compatibles; solo en hojas, diálogos, menús y avisos elevados. |
| `--space-1/2/3/4/6/8/12/16`                                                            | 4, 8, 12, 16, 24, 32, 48 y 64 px. Usar esta escala para separación y padding.                                                                   |
| `--gutter-mobile`, `--gutter-panel`, `--gutter-public`                                 | 16, 32 y 20 px. El gutter público es la excepción de contenedor especificada.                                                                   |
| `--sidebar-width`, `--content-panel`                                                   | 240 / 1120 px.                                                                                                                                  |
| `--content-booking`, `--content-profile`                                               | 480 / 560 px. El resumen lateral del wizard amplía el conjunto en desktop.                                                                      |
| `--font-sans`, `--font-display`, `--font-mono`                                         | Jakarta, Instrument Serif y monospace de sistema. Las dos fuentes web vienen de `next/font`; los fallbacks conservan contenido legible.         |
| `--font-weight-bold/extrabold/black`                                                   | Alias de compatibilidad a 600. Nuevos componentes usan normal/medium/semibold.                                                                  |
| `--text-xs/sm/base/lg/xl/2xl/3xl/4xl`                                                  | 11, 13, 15, 17, 22, 28, 36 y 44 px. Líneas: 1.4 UI, 1.5 cuerpo, 1.2 títulos/display.                                                            |
| `--animate-fade-in`, `--animate-fade-up`                                               | 200 ms ease-out; el alias antiguo no desplaza contenido ni crea cascadas.                                                                       |
| `--animate-slide-in-right/left/top/bottom`                                             | 250 ms ease-out para hojas. `prefers-reduced-motion` elimina desplazamientos perceptibles y demoras.                                            |

Cada token de color tiene una utilidad Tailwind mediante su alias `--color-*`, por ejemplo `bg-status-pending-soft` y `text-status-pending-foreground`. Los colores de estado identifican bordes o superficies; el sufijo `foreground` aporta tinta con contraste suficiente para texto pequeño. El coral original sobre blanco solo da 3.57:1; la tinta `#AC4334` da 5.82:1. El gris original sobre la superficie secundaria da 4.36:1, de ahí su tinta específica.

### Card o sección

Una **sección** es `SectionHeader` y contenido sobre el fondo, con separación de 24–32 px o una regla de 1 px. Se usa para Hoy, Esta semana, datos personales, listas y configuración. No necesita card ni sombra. Una **Card** agrupa una unidad que puede abrirse o editarse —servicio, cita, paciente— o un KPI independiente. No anidar cards para crear títulos, subtítulos o un dato de una línea. Nunca aplicar sombra a una card en reposo.

`PageHeader` contiene un título y las acciones de página. `description` solo admite contexto útil, como una fecha o cantidad. `Toolbar` agrupa controles de una tarea sin alterar su teclado nativo. `SectionHeader` admite `as="h3"` cuando la jerarquía lo requiere. `DataList`/`DataRow` producen `ul`/`li`; el consumidor conserva los links y acciones reales. `KPI` usa `dl/dt/dd`, recibe el dato y un delta real; no calcula ni inventa métricas.

| Primitivo                                 | Disciplina visual                                                                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button                                    | 40 px en panel desktop, 48 px en móvil/público; radios de 6. `size="sm"` conserva los 40 px con texto de 13 px y menos padding. Una acción primaria por vista, sin icono junto al texto salvo flechas. |
| Input, Textarea, Label, FormField, Select | Labels 13/500; input 44 móvil/40 desktop, borde de 1 px, foco de 2 px al 40%. Ayuda y error 13 px vinculados al control.                                                |
| Badge                                     | `confirmed`, `pending`, `done`, `cancelled` representan estados. El texto siempre expresa el estado además del color.                                                   |
| Tabs                                      | Subrayado, texto de 15 px, selección y teclado Radix. Sin pill ni sombra.                                                                                               |
| SegmentedControl                          | Radios nativos compactos; selección única con fondo blanco y texto principal.                                                                                           |
| FilterChip                                | Superficie de 28 px y objetivo táctil de 44 px en móvil; `aria-pressed`, sin checkbox.                                                                                  |
| Stepper                                   | Línea de progreso fina y texto “Paso 2 de 4 · Fecha”; cada paso conserva `aria-current` y estado accesible.                                                             |
| Timeline                                  | Bloques proporcionales con borde de estado de 3 px. `TimelineBlock.status` es opcional; los rangos libres conservan la acción y se dibujan discretamente.               |
| EmptyState                                | Icono neutro, línea principal y acción contextual; descripción opcional. Sin caja centrada ni card.                                                                     |
| SkeletonRow, SkeletonKPI                  | Formas de la información que está cargando, ocultas al lector de pantalla. El contenedor anuncia el estado de carga cuando corresponda.                                 |
| Avatar                                    | Iniciales sobre superficie secundaria y tinta principal; no usa verde como decoración.                                                                                  |
| Sheet, Dialog                             | Radio 12, elevación única, foco y Escape de Radix. Sheet para contexto; Dialog para confirmar.                                                                          |
| Switch                                    | Estado, nombre y teclado nativos de Radix; forma de control de 6 px.                                                                                                    |

Iconos lucide: 16 px en controles densos, 20 px en navegación, trazo 1.75 y color heredado del texto. No usar emoji. La página `/dev/ui` muestra todas las familias y estados; el servidor responde 404 fuera de desarrollo, incluso en builds de producción.
