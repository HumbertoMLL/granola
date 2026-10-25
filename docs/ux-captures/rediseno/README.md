# Comparativas del rediseño visual

36 capturas iniciales y 36 comparativas finales: 18 estados a 390 y 1280 px. Se añaden diez capturas del catálogo, primera revisión y versión final del shell, edición de configuración y confirmación final. Todas usan datos ficticios del seed, sin servicios externos activos.

El antes corresponde a `main` en `4c38c0c`. La ficha se volvió a capturar contra una referencia temporal limpia de ese commit para comprobar que fuera el expediente real. El manifiesto guarda las rutas locales de la sesión de captura.

## Reproducir la revisión

1. Arranca `docker-compose -f docker-compose.local.yml up -d`, aplica las migraciones locales y ejecuta `pnpm db:seed` en una base de desarrollo. No uses una base compartida con tests que hagan reset.
2. Ejecuta `pnpm --filter @granola/web exec next dev -p 3100` (se usó 3196 porque 3100 estaba ocupado). Entra con `karla@granola.demo` / `granola-demo-2026`.
3. Recorre las rutas de la tabla en contextos de 390 × 900 y 1280 × 900, locale es-MX y zona Ciudad de México. Las capturas PNG incluyen la página completa; el header/nav fijo aparece en su posición del viewport inicial.
4. En reserva selecciona Seguimiento, una fecha y un horario; captura cada paso sin confirmar. En Agenda captura Día y Semana. En Pacientes abre la ficha de Ana.
5. Para gestión usa el token demo `seed-karla-hoy-confirmada-0002`. Para el formulario de reseña crea una cita demo completada sin reseña; la sesión de captura usó `visual-review-karla-2026`. No son tokens de pacientes reales.
6. Comprueba los estados de edición: Sheets de configuración, Nueva medición, Vista previa y confirmación de cancelación. El catálogo `/dev/ui` solo está disponible con NODE_ENV=development.

La regresión funcional se verifica con `pnpm e2e`; incluye axe en perfil, los cuatro pasos de reserva y dashboard, a ambos anchos. Los tests conservan su propia base y servidor.

## 390 px

| Pantalla | Antes | Después |
| --- | --- | --- |
| / | [![Antes: /](antes/inicio-390.png)](antes/inicio-390.png) | [![Después: /](despues/inicio-390.png)](despues/inicio-390.png) |
| /login | [![Antes: /login](antes/login-390.png)](antes/login-390.png) | [![Después: /login](despues/login-390.png)](despues/login-390.png) |
| /registro | [![Antes: /registro](antes/registro-390.png)](antes/registro-390.png) | [![Después: /registro](despues/registro-390.png)](despues/registro-390.png) |
| /karla | [![Antes: /karla](antes/perfil-390.png)](antes/perfil-390.png) | [![Después: /karla](despues/perfil-390.png)](despues/perfil-390.png) |
| Reserva · Servicio | [![Antes: Reserva · Servicio](antes/reserva-1-390.png)](antes/reserva-1-390.png) | [![Después: Reserva · Servicio](despues/reserva-1-390.png)](despues/reserva-1-390.png) |
| Reserva · Fecha | [![Antes: Reserva · Fecha](antes/reserva-2-390.png)](antes/reserva-2-390.png) | [![Después: Reserva · Fecha](despues/reserva-2-390.png)](despues/reserva-2-390.png) |
| Reserva · Hora | [![Antes: Reserva · Hora](antes/reserva-3-390.png)](antes/reserva-3-390.png) | [![Después: Reserva · Hora](despues/reserva-3-390.png)](despues/reserva-3-390.png) |
| Reserva · Tus datos | [![Antes: Reserva · Tus datos](antes/reserva-4-390.png)](antes/reserva-4-390.png) | [![Después: Reserva · Tus datos](despues/reserva-4-390.png)](despues/reserva-4-390.png) |
| /app | [![Antes: /app](antes/dashboard-390.png)](antes/dashboard-390.png) | [![Después: /app](despues/dashboard-390.png)](despues/dashboard-390.png) |
| Agenda · Día | [![Antes: Agenda · Día](antes/agenda-dia-390.png)](antes/agenda-dia-390.png) | [![Después: Agenda · Día](despues/agenda-dia-390.png)](despues/agenda-dia-390.png) |
| Agenda · Semana | [![Antes: Agenda · Semana](antes/agenda-semana-390.png)](antes/agenda-semana-390.png) | [![Después: Agenda · Semana](despues/agenda-semana-390.png)](despues/agenda-semana-390.png) |
| /app/pacientes | [![Antes: /app/pacientes](antes/pacientes-390.png)](antes/pacientes-390.png) | [![Después: /app/pacientes](despues/pacientes-390.png)](despues/pacientes-390.png) |
| Ficha del paciente | [![Antes: Ficha del paciente](antes/expediente-390.png)](antes/expediente-390.png) | [![Después: Ficha del paciente](despues/expediente-390.png)](despues/expediente-390.png) |
| /app/cobros | [![Antes: /app/cobros](antes/cobros-390.png)](antes/cobros-390.png) | [![Después: /app/cobros](despues/cobros-390.png)](despues/cobros-390.png) |
| /app/mi-pagina | [![Antes: /app/mi-pagina](antes/mi-pagina-390.png)](antes/mi-pagina-390.png) | [![Después: /app/mi-pagina](despues/mi-pagina-390.png)](despues/mi-pagina-390.png) |
| /app/configuracion | [![Antes: /app/configuracion](antes/configuracion-390.png)](antes/configuracion-390.png) | [![Después: /app/configuracion](despues/configuracion-390.png)](despues/configuracion-390.png) |
| Gestión de cita | [![Antes: Gestión de cita](antes/cita-390.png)](antes/cita-390.png) | [![Después: Gestión de cita](despues/cita-390.png)](despues/cita-390.png) |
| Reseña | [![Antes: Reseña](antes/resena-390.png)](antes/resena-390.png) | [![Después: Reseña](despues/resena-390.png)](despues/resena-390.png) |

## 1280 px

| Pantalla | Antes | Después |
| --- | --- | --- |
| / | [![Antes: /](antes/inicio-1280.png)](antes/inicio-1280.png) | [![Después: /](despues/inicio-1280.png)](despues/inicio-1280.png) |
| /login | [![Antes: /login](antes/login-1280.png)](antes/login-1280.png) | [![Después: /login](despues/login-1280.png)](despues/login-1280.png) |
| /registro | [![Antes: /registro](antes/registro-1280.png)](antes/registro-1280.png) | [![Después: /registro](despues/registro-1280.png)](despues/registro-1280.png) |
| /karla | [![Antes: /karla](antes/perfil-1280.png)](antes/perfil-1280.png) | [![Después: /karla](despues/perfil-1280.png)](despues/perfil-1280.png) |
| Reserva · Servicio | [![Antes: Reserva · Servicio](antes/reserva-1-1280.png)](antes/reserva-1-1280.png) | [![Después: Reserva · Servicio](despues/reserva-1-1280.png)](despues/reserva-1-1280.png) |
| Reserva · Fecha | [![Antes: Reserva · Fecha](antes/reserva-2-1280.png)](antes/reserva-2-1280.png) | [![Después: Reserva · Fecha](despues/reserva-2-1280.png)](despues/reserva-2-1280.png) |
| Reserva · Hora | [![Antes: Reserva · Hora](antes/reserva-3-1280.png)](antes/reserva-3-1280.png) | [![Después: Reserva · Hora](despues/reserva-3-1280.png)](despues/reserva-3-1280.png) |
| Reserva · Tus datos | [![Antes: Reserva · Tus datos](antes/reserva-4-1280.png)](antes/reserva-4-1280.png) | [![Después: Reserva · Tus datos](despues/reserva-4-1280.png)](despues/reserva-4-1280.png) |
| /app | [![Antes: /app](antes/dashboard-1280.png)](antes/dashboard-1280.png) | [![Después: /app](despues/dashboard-1280.png)](despues/dashboard-1280.png) |
| Agenda · Día | [![Antes: Agenda · Día](antes/agenda-dia-1280.png)](antes/agenda-dia-1280.png) | [![Después: Agenda · Día](despues/agenda-dia-1280.png)](despues/agenda-dia-1280.png) |
| Agenda · Semana | [![Antes: Agenda · Semana](antes/agenda-semana-1280.png)](antes/agenda-semana-1280.png) | [![Después: Agenda · Semana](despues/agenda-semana-1280.png)](despues/agenda-semana-1280.png) |
| /app/pacientes | [![Antes: /app/pacientes](antes/pacientes-1280.png)](antes/pacientes-1280.png) | [![Después: /app/pacientes](despues/pacientes-1280.png)](despues/pacientes-1280.png) |
| Ficha del paciente | [![Antes: Ficha del paciente](antes/expediente-1280.png)](antes/expediente-1280.png) | [![Después: Ficha del paciente](despues/expediente-1280.png)](despues/expediente-1280.png) |
| /app/cobros | [![Antes: /app/cobros](antes/cobros-1280.png)](antes/cobros-1280.png) | [![Después: /app/cobros](despues/cobros-1280.png)](despues/cobros-1280.png) |
| /app/mi-pagina | [![Antes: /app/mi-pagina](antes/mi-pagina-1280.png)](antes/mi-pagina-1280.png) | [![Después: /app/mi-pagina](despues/mi-pagina-1280.png)](despues/mi-pagina-1280.png) |
| /app/configuracion | [![Antes: /app/configuracion](antes/configuracion-1280.png)](antes/configuracion-1280.png) | [![Después: /app/configuracion](despues/configuracion-1280.png)](despues/configuracion-1280.png) |
| Gestión de cita | [![Antes: Gestión de cita](antes/cita-1280.png)](antes/cita-1280.png) | [![Después: Gestión de cita](despues/cita-1280.png)](despues/cita-1280.png) |
| Reseña | [![Antes: Reseña](antes/resena-1280.png)](antes/resena-1280.png) | [![Después: Reseña](despues/resena-1280.png)](despues/resena-1280.png) |

## Estados adicionales

| Estado | Móvil | Escritorio |
| --- | --- | --- |
| Catálogo de primitivos | [Ver](despues/sistema-390.png) | [Ver](despues/sistema-1280.png) |
| Shell · primera revisión | [Ver](despues/shell-390.png) | [Ver](despues/shell-1280.png) |
| Edición en Sheet | [Ver](despues/configuracion-editar-390.png) | [Ver](despues/configuracion-editar-1280.png) |
| Reserva confirmada | [Ver](despues/listo-390.png) | [Ver](despues/listo-1280.png) |
| Shell · versión final | [Ver](despues/shell-final-390.png) | [Ver](despues/shell-final-1280.png) |
