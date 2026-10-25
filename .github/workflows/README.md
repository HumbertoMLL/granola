# CI (GitHub Actions)

`ci.yml` corre en cada `push` a `main` y en cada `pull_request`. Un push nuevo a la misma rama cancela el run anterior (`concurrency`).

| Job (nombre en GitHub) | Qué corre | Servicios |
|---|---|---|
| **Lint, typecheck, build y unit tests** (`checks`) | `pnpm lint`, `pnpm typecheck`, `next build` de apps/web, `pnpm test` (vitest unit en core, whatsapp, payments y web) | ninguno |
| **Tests de integración (Postgres real)** (`integration`) | `pnpm test:integration` (`apps/web/**/*.int.test.ts`) | Postgres 17 (`granola_test`, puerto 5433) + proxy neon-http en 4445 |
| **E2E (Playwright)** (`e2e`) | `pnpm e2e`: reservar en `/karla/agendar` → la nutri ve la cita en `/app/agenda` → la paciente cancela en `/cita/<token>` | igual que integración + Chromium (cacheado) |

Ningún job usa secretos: todo corre con `apps/web/.env.test` (llaves ficticias). Stripe se prueba firmando eventos con una clave falsa; Inngest, WhatsApp y Mercado Pago no se llaman.

## Cómo leer un run

1. En el PR, sección **Checks**, o en la pestaña **Actions** → workflow **CI** → el run.
2. Cada job es una caja; si uno está en rojo, ábrelo y despliega el paso que falló.
   - `checks` → el paso dice si fue lint, typecheck, build o unit tests.
   - `integration` → la salida de vitest nombra el `describe`/`it` que falló (están escritos como frases: "Cuando una paciente agenda… › la cita queda confirmada…"). Si falló el arranque, el paso **Logs del proxy** muestra el proxy neon-http.
   - `e2e` → el reporte de Playwright con trace y screenshot se sube como artefacto **playwright-report** (abajo en la página del run). Ábrelo localmente con `pnpm --filter @granola/web exec playwright show-report <carpeta>` o arrastra `trace.zip` a https://trace.playwright.dev.
3. Reproducir local (con `docker-compose -f docker-compose.local.yml up -d`): `pnpm test`, `pnpm test:integration`, `pnpm e2e`.

## Proteger `main` (se configura en GitHub, no en el YAML)

El YAML solo corre los checks; lo que impide mergear en rojo es la regla de la rama:

1. GitHub → repo → **Settings** → **Branches** (o **Rules → Rulesets**) → **Add branch protection rule / New ruleset**.
2. Branch name pattern: `main`.
3. Activa **Require a pull request before merging**.
4. Activa **Require status checks to pass before merging** y **Require branches to be up to date before merging**.
5. En el buscador de checks agrega los tres (aparecen después de que el workflow haya corrido al menos una vez):
   - `Lint, typecheck, build y unit tests`
   - `Tests de integración (Postgres real)`
   - `E2E (Playwright)`
6. Opcional: **Do not allow bypassing the above settings** para que tampoco los admins mergeen en rojo.

Con `gh` (requiere permisos de admin; ajusta `OWNER/REPO`):

```bash
gh api -X PUT repos/OWNER/REPO/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -F required_status_checks[strict]=true \
  -f "required_status_checks[contexts][]=Lint, typecheck, build y unit tests" \
  -f "required_status_checks[contexts][]=Tests de integración (Postgres real)" \
  -f "required_status_checks[contexts][]=E2E (Playwright)" \
  -F enforce_admins=true \
  -F required_pull_request_reviews[required_approving_review_count]=0 \
  -F restrictions=null
```

Si renombras un job en `ci.yml`, actualiza también la lista de checks requeridos (si no, GitHub espera para siempre un check que ya no existe).
