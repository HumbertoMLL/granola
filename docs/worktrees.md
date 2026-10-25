# Trabajo en paralelo con worktrees (Codex + Claude Code)

Cada tarea vive en **su propia carpeta y rama**. Los agentes no se pisan; la integración es por PR a `main`, y CI decide si entra.

```
~/Desktop/granola/              main        puerto 3100   ← coordinador (tú / Claude)
~/Desktop/granola-wt/expediente feature/…   puerto 31xx   ← Codex
~/Desktop/granola-wt/docker     feature/…   puerto 31xx   ← Claude
~/Desktop/granola-wt/calendar   feature/…   puerto 31xx   ← Codex
```

## Flujo (3 comandos)

```bash
scripts/wt.sh nueva expediente        # crea rama feature/expediente + carpeta + deps + puerto
cd ../granola-wt/expediente && codex   # pega el prompt de abajo
# cuando el agente termine y CI esté en verde:
gh pr merge --squash --delete-branch  # desde el PR, o desde GitHub
scripts/wt.sh borrar expediente
```

`scripts/wt.sh lista` muestra qué hay abierto y en qué puerto.

## Prompt para arrancar una tarea (Codex o Claude)

Copia esto y cambia solo la primera línea:

```
Tarea: <una frase, p. ej. "F2: pacientes + expediente básico (lista, alta manual, ficha con antropometría)">

Estás en un git worktree aislado de Granola, en la rama feature/<slug>. Antes de tocar nada lee, en este orden: AGENTS.md, CLAUDE.md, PLAN.md (la fase de esta tarea), STACK.md y docs/adr/. Respeta las reglas duras de CLAUDE.md sin excepción (datos de salud solo vía API, filtro por nutritionist_id, zod en fronteras, sin any).

Alcance: solo lo que dice la tarea. Si descubres algo fuera de alcance, anótalo en tu reporte final, no lo hagas.
Archivos compartidos con otros agentes (package.json raíz, pnpm-lock.yaml, packages/db/src/schema, migraciones, CLAUDE.md, AGENTS.md): tócalos solo si la tarea lo exige y dilo en el PR.
Migraciones: si agregas columnas, genera la migración con `pnpm db:generate --name <nombre>` y aplícala en tu DB local con psql (ver docs/granola-overview.html, sección Acceso).

Terminado significa: `pnpm typecheck && pnpm lint && pnpm test && pnpm --filter @granola/web exec next build` en verde, tests nuevos para lo que agregaste (integración si toca DB), commits chicos en español, `git push -u origin feature/<slug>` y `gh pr create --fill` con un resumen de qué cambió, cómo probarlo y qué quedó fuera.
```

## Reglas de integración

1. **Una tarea = una rama = un PR.** No mezclar features.
2. **El coordinador mergea de a uno** y corre el conjunto (`pnpm test` + E2E) después de cada merge.
3. **Dueños de archivos compartidos:** schema/migraciones → el coordinador decide el orden de merge para evitar dos `0002_*.sql`. Si dos ramas generan migración, la segunda se regenera sobre `main` después del primer merge.
4. **DB por worktree (opcional):** por default todos apuntan al Postgres de Docker (`granola`). Si una tarea cambia el schema, créale su propia DB para no romper a los demás:
   ```bash
   psql postgres://granola:granola@localhost:5433/granola -c "create database granola_expediente"
   # en el .env.local del worktree: DATABASE_URL=...:5433/granola_expediente
   # y un proxy extra en docker-compose.local.yml apuntando a esa DB (copia el servicio neon-proxy con otro puerto)
   ```
5. **Nunca** `git push --force` a `main`. `main` se protege en GitHub con los checks de CI como requeridos.

## Qué le damos a cada quien

| Agente | Fortaleza | Tareas sugeridas |
|---|---|---|
| **Codex** (ChatGPT) | ejecuciones largas sin supervisión, CRUD y UI repetitiva | F2 pacientes/expediente, F3 editor de planes, importadores CSV |
| **Claude Code** | diseño de arquitectura, cambios transversales, revisión | contratos entre paquetes, migraciones, integración de PRs, auditorías |

El coordinador (esta sesión o tú) mantiene `PLAN.md` y decide qué entra y en qué orden.
