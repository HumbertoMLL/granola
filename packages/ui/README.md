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
| EmptyState                         | Lista sin datos: título, explicación y acción para continuar. Durante la carga usar Skeleton.                                                                                                                                              |
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
