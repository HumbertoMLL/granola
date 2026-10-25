# Decisiones de UX (25 oct 2026)

Base: `mockups/index.html` (3 estructuras por pantalla). Decisión de Beto por pantalla y reglas de patrones que aplican a todo el producto.

## Estructura elegida por pantalla

| Pantalla                   | Elegida                 | Qué significa                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Link tree / perfil público | **A** link-in-bio       | Foto, identidad, prueba social y botones apilados. Un solo botón primario ("Agendar consulta"); todo lo demás secundario. Bajo el CTA, "Próximo horario disponible: …" (tomado de B).                                                                                                                                                                             |
| Agendar (paciente)         | **B** wizard            | Un paso por pantalla: 1 Servicio → 2 Fecha → 3 Hora → 4 Tus datos (+ pago). Stepper arriba, resumen fijo de lo elegido, Atrás/Continuar fijos abajo. Nombre y WhatsApp son los únicos obligatorios.                                                                                                                                                               |
| Directorio                 | **A** lista con filtros | Buscador + chips de filtro arriba + lista densa. **Filtros estilo Shopify**: al activar uno aparece en una fila de "filtros aplicados" como chip removible (×), con contador de resultados actualizado y "Limpiar todo". Online / Presencial son facetas visibles siempre. (Se construye en F6; el patrón de filtros se usa desde ya en pacientes y agenda.)      |
| Agenda de la nutri         | **A + B**               | Vista de **día** como timeline (bloques proporcionales a la duración, huecos "Libre" tocables, línea de "ahora", tira de 7 días arriba) con **toggle Día / Semana**; la semana es una grilla compacta donde tocar un bloque abre el detalle en hoja inferior con acciones. La lista de "Próximas / Necesitan tu atención" (C) vive en el dashboard, no en Agenda. |

## Reglas de patrones (obligatorias)

La queja concreta: en los wireframes los íconos del tab bar parecían checkboxes. Regla general: **cada control se ve como lo que es y se comporta como lo que es.**

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

Fuente de componentes: `packages/ui` (Button, Tabs, Sheet, Dialog, Switch, Select, Badge, Input, Label, Skeleton…). Si falta un patrón (segmented control, chip de filtro, stepper, timeline), se agrega ahí, no inline en una página.

## Estado

Implementación en `feature/ux`:

- Primitivos SegmentedControl, FilterChip, AppliedFilters, Stepper, Timeline, EmptyState y FormField en packages/ui, con pruebas de render y atributos accesibles. BottomSheet reutiliza Sheet con side="bottom".
- Panel con navegación lucide/etiqueta y estados activos; Tabs internos existentes conservados.
- Perfil A con CTA único, servicios secundarios, enlaces al final y próximo horario real en servidor. Los cinco temas y el preview comparten markup.
- Reserva B de cuatro pasos con estado de selección en URL, resumen fijo, acciones inferiores, Mañana/Tarde, zona cambiable, +52, correo opcional colapsado y radios de pago/modalidad. createBooking conserva el contrato y los datos se mantienen al perder un horario.
- Agenda Día/Timeline + Semana/grilla, tira de siete días, huecos derivados de disponibilidad real, Sheet de cita, acciones existentes y filtros con aplicados/contador/limpieza.
- Auditoría por archivo en `docs/ux-audit.md`; decisión técnica en ADR 0014.
- E2E adaptado a wizard y nuevos recorridos de agenda/historial; capturas móviles en `docs/ux-captures/`.

Límites: el directorio permanece en F6. Pacientes aún es provisional en la base inicial; no se crea el módulo. El apartado de 10 minutos mostrado en los wireframes no existe en backend: no se promete ni se implementa en esta tarea de presentación. Nueva cita desde un hueco reutiliza la reserva pública prellenada. No se cambian server actions, schema, migraciones ni paquetes de backend.
