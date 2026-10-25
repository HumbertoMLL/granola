# Configuración y onboarding

- Sin columnas, migraciones ni cambios en `packages/auth`.
- La preferencia usa `nutritionists.theme.notifyNewBooking` (booleano; ausencia = activada). Configuración hace merge JSONB y conserva las opciones visuales.
- Nombre público y slug reutilizan `saveMyPage`; el adaptador mantiene los demás campos y restaura la preferencia que el contrato visual de esa action no admite. Servicios, zona horaria y disponibilidad reutilizan las actions de Agenda.
- El layout incorpora un guard con pathname para redirigir también durante navegación cliente sin crear un bucle en `/app/onboarding`. Cada action sigue autenticando independientemente; el guard no sustituye autorización.
- `onboarding_step` representa pasos completados: 0 → perfil, 1 → servicio, 2 → horario, 3 → compartir, 4 → panel. El progreso no retrocede; «Lo hago después» guarda 4.
- Exportación mediante server action autenticada, con filtros por nutritionist_id y selección explícita del perfil y citas para excluir OAuth, requisitos de Stripe y cancel_token. El JSON incluye perfil, servicios, pacientes y citas; las fechas se serializan en ISO UTC y los precios siguen en centavos.
- El borrado usa `db.batch` transaccional: citas primero (FK restrict a pacientes/servicios), después usuario. Las FK existentes eliminan perfil, servicios, disponibilidad, pacientes, reseñas, pagos, mensajes y sesiones/cuentas de Better Auth. El cliente limpia las cookies con signOut y vuelve al login. La bitácora audit_log existente se conserva.

## Verificación

`main` no expone `@granola/db/testing`. `data.test.ts` prueba lo puro: aislamiento entre nutriólogos, exclusión de secretos, fechas, cuentas vacías, confirmación exacta y orden/alcance del borrado. Además se verificaron los dos DELETE contra Postgres local dentro de BEGIN/ROLLBACK, comprobando cero filas relacionadas antes de revertir.

```sh
pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @granola/web exec next build
```

Prueba manual con la DB local en 5433:

1. Iniciar Next con el origen de Better Auth y NEXT_PUBLIC_APP_URL apuntando al puerto usado. Entrar con karla@granola.demo / granola-demo-2026.
2. En Configuración cambiar nombre, zona y toggle; recargar y comprobar persistencia. Exportar JSON y abrirlo. Revisar el aviso y el diálogo de eliminación: solo ELIMINAR habilita la acción definitiva. Usar una cuenta desechable para ejecutar el borrado definitivo.
3. Con psql: `UPDATE nutritionists SET onboarding_step=0 WHERE slug='karla';` y recargar `/app/configuracion`: debe redirigir al wizard.
4. Completar perfil y slug, crear un servicio, editar una ventana del horario y guardar; recargar entre pasos para comprobar progreso. En el cuarto paso revisar el link y compartir/copiar. Terminar y entrar al panel.
5. Volver a poner el paso en 0 y probar «Lo hago después»: debe guardar 4 y abrir el panel.

## Fuera del alcance

- `packages/jobs` todavía no consulta notifyNewBooking: esta entrega guarda la preferencia, sin modificar el envío de WhatsApp.
- El editor anterior de Mi página reemplaza theme al guardar. Si se usa directamente después de Configuración puede descartar notifyNewBooking. Corregir su persistencia requiere tocar `mi-pagina/actions.ts`, fuera de las rutas autorizadas; los nuevos flujos sí conservan la preferencia.
- El borrado corresponde a la DB local: no cierra cuentas de Stripe/MP ni borra objetos de R2. No agrega migraciones ni un historial nuevo de auditoría.
- La apertura adicional de `/karla` en dev mostró `next-request-in-use-cache` en el loader existente `src/lib/public-profile.ts:70` (sin diferencias contra main). La misma página funciona con `next start` sobre el build de producción: perfil, servicios y reseñas renderizados. Se documenta sin modificar ese loader fuera del alcance.
