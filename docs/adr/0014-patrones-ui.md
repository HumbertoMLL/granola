# ADR 0014 — Patrones de interfaz compartidos

Fecha: 2026-10-24 · Estado: aceptado para implementación según docs/ux-decisions.md.

## Contexto

Los wireframes A/B/C exploran estructuras, pero también contienen contradicciones con las reglas finales (íconos cuadrados, CTA repetido, pago como chip y un apartado de 10 minutos). `docs/ux-decisions.md` es la fuente de verdad de la presentación; las capacidades reales del servidor son la fuente de verdad de la reserva.

## Decisión

- Perfil A: un CTA principal, servicios secundarios y enlaces al final; el próximo horario se calcula en servidor con el motor existente, dentro de Suspense y fuera de la caché del perfil.
- Reserva B: Servicio → Fecha → Hora → Tus datos. URL con paso/servicio/fecha/hora mediante History API integrada con Next; datos personales solo en estado React, nunca en URL ni almacenamiento persistente. El servidor revalida al confirmar; un conflicto recarga horarios y conserva el formulario.
- Agenda A+B: día como Timeline proporcional y semana de siete columnas. La Sheet muestra detalle y reutiliza las acciones de cita existentes. Los huecos se calculan con el motor de scheduling usando toda la agenda, independientemente de los filtros.
- Radios nativos dentro de SegmentedControl para selección única. FilterChip + AppliedFilters para facetas opcionales (modalidades combinadas como OR, resto como AND). Tabs para navegación interna.
- Reutilizar Sheet con side="bottom" como BottomSheet: misma gestión de foco, Escape, overlay y nombre/descripción accesibles de Radix. Dialog queda para confirmaciones.
- FormField vincula label, ayuda y error al control; EmptyState y Skeleton comparten los estados sin datos y de carga.
- Todo usa la paleta y radios de packages/ui/src/styles.css. Se conservan los cinco presets del perfil y su preview.

## Consecuencias y límites

No cambian server actions, schema, migraciones ni paquetes de backend. No se promete un apartado de 10 minutos: no existe esa capacidad y agregarla excedería presentación. Nueva cita desde un hueco abre el flujo público con servicio/fecha/hora prellenados y consentimiento; Bloquear usa addAvailabilityOverride. Las acciones Completada/No asistió conservan la restricción temporal del servidor.

El directorio sigue programado para F6. Pacientes en la base inicial es una pantalla provisional: se corrigen label y estado vacío, sin crear el módulo. Se volverá a revisar main al rebase final.

Las pruebas permiten GRANOLA_TEST_DATABASE_URL y GRANOLA_TEST_PROXY para una base cuyo nombre termina en \_test por worktree, y E2E_PORT para evitar colisiones de puertos. Los valores por defecto y la CI no cambian.
