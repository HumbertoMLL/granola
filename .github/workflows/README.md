# CI (GitHub Actions)

`ci.yml` corre en cada `push` a `main` y en cada `pull_request`. Un push nuevo a la misma rama cancela el run anterior (`concurrency`).

| Job (nombre en GitHub) | Qué corre | Servicios |
|---|---|---|
| **Lint, typecheck, build y unit tests** (`checks`) | `pnpm check:migrations`, `pnpm lint`, `pnpm typecheck`, `next build` de apps/web, `pnpm test` (vitest unit en core, whatsapp, payments y web) | ninguno |
| **Tests de integración (Postgres real)** (`integration`) | `pnpm test:integration` (`apps/web/**/*.int.test.ts`) | Postgres 17 (`granola_test`, puerto 5433) + proxy neon-http en 4445 |
| **E2E (Playwright)** (`e2e`) | `pnpm e2e`: reservar en `/karla/agendar` → la nutri ve la cita en `/app/agenda` → la paciente cancela en `/cita/<token>` | igual que integración + Chromium (cacheado) |
| **Docker (build runner)** (`docker`) | `docker build --target runner -f apps/web/Dockerfile .` (sin push). **No es check requerido**: no lo agregues a la protección de `main` salvo que se decida | ninguno |

Ningún job de **CI** usa secretos: todo corre con `apps/web/.env.test` (llaves ficticias). Stripe se prueba firmando eventos con una clave falsa; Inngest, WhatsApp y Mercado Pago no se llaman.

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


### Hacer requerido Docker (cuando se decida)

El job **Docker (build runner)** ya corre, pero sigue siendo opcional. Este PR no
cambia la protección de `main` ni activa ese requisito.

Para exigirlo más adelante, un administrador debe:

1. Esperar un run verde de **CI** que incluya **Docker (build runner)**; así GitHub
   puede ofrecer el contexto en el buscador de checks.
2. Abrir **Settings → Branches → main → Edit**, o el ruleset que protege `main`.
3. En **Require status checks to pass before merging**, agregar exactamente
   **Docker (build runner)**, conservando los tres checks requeridos de arriba y
   **Require branches to be up to date before merging**.
4. Guardar y revisar en un PR que el job se muestre como **Required**. Si se
   renombra el job, actualizar también esta regla para no bloquear los merges.

## Deploy: migraciones como parte del release

`deploy.yml` escucha `workflow_run` del workflow **CI**, `completed`, rama `main`.
El job `migrate` solo corre si el resultado es `success`, el origen fue un **push** a
`main` del mismo repo y el commit sigue siendo el HEAD de `main` al empezar. Hace
checkout del `head_sha` validado (no de main móvil), instala con lockfile y ejecuta
`pnpm --filter @granola/db migrate`. El grupo `migrate-prod`, con
`cancel-in-progress: false`, serializa producción. GitHub puede reemplazar runs
pendientes por uno más reciente; el historial de migraciones es acumulativo.

Si falla instalar, validar la URL o migrar, el job falla y publica `failure` en el
commit exacto, contexto **`granola/migrate-production`**. Solo publica `success`
cuando todos esos pasos terminaron bien. No hay un comando de promoción incondicional.
Si se cancela antes de publicar el resultado, un estado pendiente tampoco autoriza
promoción. Reejecutar el run es seguro para las migraciones ya registradas por Drizzle;
si apareció otro commit en main, debe completar su propio CI.

### Secrets de GitHub (Settings → Secrets and variables → Actions)

| Secret | Uso | Valor esperado |
|---|---|---|
| `DATABASE_URL` | Job `migrate` de producción | URI **directa**, sin `-pooler`, del branch y base de producción en Neon, con TLS (`sslmode=require`) y permisos DDL. Debe corresponder al schema usado por Vercel |
| `NEON_API_KEY` | Crear/reutilizar/borrar previews | API key con acceso al proyecto Neon; no se escribe en comentarios ni artefactos |
| `NEON_PROJECT_ID` | Seleccionar proyecto para previews | ID del proyecto, no el ID del branch |

`GITHUB_TOKEN` lo genera Actions; el YAML limita permisos a `statuses: write` para
producción y `pull-requests: write` para el comentario de preview. No requiere un PAT.
La ausencia de `DATABASE_URL` **falla producción**; la ausencia de keys de preview
**omite** sus pasos y lo explica en el resumen. GitHub no admite `secrets.*` directamente
en `if`; el equivalente válido es pasarlos a `env` en el paso de configuración y
condicionar los siguientes por su output booleano. No se usa `pull_request_target`.

Variables opcionales de Actions (no secretos): `NEON_PARENT_BRANCH` (default `production`)
y `NEON_DATABASE_NAME` (default `neondb`). Configúralas si el branch real de producción
se llama `main` o la base tiene otro nombre. `DATABASE_URL` no se deduce de estos valores.

### Coordinación con Vercel (obligatoria para NO promover con migración fallida)

1. Conserva Vercel Git Integration para construir en cada push y las env vars de
   producción en Vercel. Añade **`granola/migrate-production`** como GitHub Deployment Check
   en **Project Settings → Deployment Checks → Add Checks → GitHub** para producción.
   El estado aparece después del primer run; para el arranque inicial, deja la
   asignación automática de dominios desactivada hasta haberlo configurado.
2. Con automatic aliasing activado y ese check exigido, Vercel crea el deployment
   pero espera `success` antes de asignar los dominios. Si `migrate` falla, no promover,
   no usar **Force Promote** y revisar el SQL/log de Actions. El schema de la versión
   servida sigue siendo válido por la regla **expand/contract**.
3. Si tu proyecto no permite usar Deployment Checks, desactiva **Auto-assign Custom
   Production Domains** en Production Environment Settings. Los builds quedan staged;
   promociona el **deployment del mismo SHA**, solo después de `migrate` verde. También
   se puede usar `npx vercel@65 deploy --prod --skip-domain` y luego `npx vercel@65 promote <deployment>`.
   Automatizar esa promoción con credenciales Vercel queda fuera de este PR.

Un `workflow_run` **por sí solo no frena Vercel**. El YAML emite el estado correcto;
la selección del check o desactivación de aliasing es configuración externa que debe
hacer el administrador. No se modifican ajustes de Vercel desde este workflow.

Referencias: [GitHub workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run),
[Vercel Deployment Checks](https://vercel.com/docs/deployment-checks),
[staged production deployments](https://vercel.com/docs/deployments/promoting-a-deployment).

### Preview de PR

En `opened`, `synchronize` y `reopened`, para PRs del mismo repo, se crea o reutiliza
`pr-<número>` desde production vía la [API REST de Neon](https://neon.com/docs/guides/branching-neon-api).
Se crea compute read/write y TTL de 7 días. Las operaciones se serializan por PR y consultan su estado/HEAD actual para tolerar eventos fuera de orden.
Se obtiene la URI directa, se enmascara en Actions, se migra y se publica/actualiza
un único comentario con el enlace a la consola de Neon. La contraseña se mantiene
en el runner. El cierre usa el mismo grupo y borra solo el branch con nombre exacto;
cierres repetidos no fallan. Fallos de borrado dejan el job rojo; el TTL limita huérfanos.
PRs abiertos antes de instalar el workflow necesitan actualizarse o reabrirse para correrlo.

No se transfieren datos a comentarios ni se configura `DATABASE_URL` de Vercel Preview.
Los branches normales incluyen datos del padre; limita el acceso al repo y proyecto a
colaboradores autorizados. Forks y Dependabot omiten el job. Para una política que prohíba
copiar filas de producción, habrá que cambiar a previews anonimizados/schema-only en
otro workstream.

### Verificar cambios de este flujo

```sh
pnpm check:migrations
pnpm typecheck && pnpm lint && pnpm test
# También valida el build en un checkout nuevo:
pnpm --filter @granola/web exec next build
actionlint .github/workflows/ci.yml .github/workflows/deploy.yml
```

`check:migrations` usa Git y el API de snapshots de Drizzle Kit; no conecta a ninguna DB
ni genera archivos. Exige SQL + journal nuevos ante cambios de schema, rechaza reescrituras
de SQL/snapshots ya presentes en la base Git, contrasta el schema con el último snapshot
y ejecuta `drizzle-kit check` para validar el historial. CI obtiene todo el historial
con `fetch-depth: 0` y pasa `pull_request.base.sha` o el SHA anterior del push como base.
Los tests de `scripts/*.test.ts` cubren estas decisiones y el ciclo de Neon con HTTP
simulado; corren dentro de `pnpm test`, y sus tipos se revisan con `pnpm typecheck`.
La prueba real en Neon requiere cargar los secrets y abrir/actualizar un PR. No pruebes
un fallo intencional de SQL en producción; hazlo en su branch de preview.
