# Configuración y onboarding

Alcance de este PR: perfil de cuenta, contraseña, sesión, zona horaria, idioma, exportación de datos y wizard de onboarding. **El borrado de cuenta no vive aquí**: va en su propio PR (borrado lógico con 30 días de gracia, ADR 0015).

## Decisiones

- **Nombre y slug** (`components/configuracion/save-profile.ts`): una sola escritura (`UPDATE nutritionists SET display_name, slug`) o `db.batch` con `users.name` cuando cambia el nombre desde Configuración. No reescribe `theme` ni `links`: no hay copia vieja que pise lo que Mi página guardó.
- **Exportación** (`export.ts` + `exportAccount`): JSON descargable con perfil, servicios, disponibilidad (reglas y excepciones), pacientes, citas y pagos, todo filtrado por `nutritionist_id`. Columnas explícitas: no salen tokens OAuth, requisitos de Stripe ni `cancel_token`. Cada descarga inserta `account.export` en `audit_log` (actor, IP, conteos). Mediciones y notas clínicas se agregan cuando PR #2 (expediente) esté en main.
- **Gate de onboarding** (server-side): `proxy.ts` pasa el pathname en el header `x-granola-pathname`; el layout del panel llama `enforceOnboarding()` (`lib/onboarding-gate.ts`), que hace `redirect("/app/onboarding")` si `onboarding_step < 4` y la ruta no es el wizard. En `/app/onboarding` el layout no pinta sidebar ni tab bar, así no hay enlaces de navegación cliente que esquiven el gate.
- **`onboarding_step`** = pasos completados: 0 → perfil, 1 → servicio, 2 → horario, 3 → compartir, 4 → panel. No retrocede (`greatest`); «Lo hago después» guarda 4.
- **Backfill**: `packages/db/migrations/0003_onboarding_backfill.sql` marca con 4 a las nutris que ya existían; las nuevas nacen con 0 (default) y pasan por el wizard. (0002 lo usa el expediente, PR #2.)
- **Link público** del wizard: `NEXT_PUBLIC_APP_URL` → `BETTER_AUTH_URL` → host del request (`lib/app-url.ts`). Nada hardcodeado.

## Verificación

```sh
pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @granola/web exec next build
pnpm test:integration   # configuracion/actions.int.test.ts, onboarding/onboarding.int.test.ts
```

Prueba manual con la DB local:

1. Entrar con karla@granola.demo / granola-demo-2026. En Configuración cambiar nombre y zona; recargar. Exportar JSON y revisar que solo trae datos de Karla.
2. `UPDATE nutritionists SET onboarding_step=0 WHERE slug='karla';` y abrir cualquier ruta del panel: redirige al wizard (sin navegación).
3. Completar los pasos recargando entre ellos; «Lo hago después» deja el paso en 4 y abre el panel.

## Fuera del alcance

- Aviso por WhatsApp al agendar: el toggle se quitó de la UI; vuelve con columna propia (`nutritionists.notify_new_booking`) y conectado a `packages/jobs`.
- Borrado de cuenta: PR "Borrado lógico de cuenta con 30 días de gracia".
