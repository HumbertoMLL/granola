#!/usr/bin/env bash
# Crea (o abre) un git worktree para una tarea, listo para que un agente trabaje aislado.
#
#   scripts/wt.sh nueva <slug> [base]   → rama feature/<slug>, carpeta ../granola-wt/<slug>, puerto propio
#   scripts/wt.sh lista                 → worktrees activos y su puerto
#   scripts/wt.sh borrar <slug>         → elimina worktree y rama local (la remota queda)
#
# Cada worktree copia apps/web/.env.local (apuntan a la misma DB local de Docker; para
# aislar datos usa otra DB: ver docs/worktrees.md) y recibe un puerto 31xx distinto.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WT_DIR="$(dirname "$ROOT")/granola-wt"
cmd="${1:-}"; slug="${2:-}"; base="${3:-main}"

port_for() { # puerto estable por slug: 3101..3199
  local h; h=$(printf '%s' "$1" | cksum | cut -d' ' -f1)
  echo $((3101 + h % 99))
}

case "$cmd" in
  nueva)
    [ -n "$slug" ] || { echo "uso: scripts/wt.sh nueva <slug> [base]"; exit 1; }
    dir="$WT_DIR/$slug"; branch="feature/$slug"; port=$(port_for "$slug")
    mkdir -p "$WT_DIR"
    if [ -d "$dir" ]; then echo "ya existe: $dir"; else
      git -C "$ROOT" fetch -q origin "$base" 2>/dev/null || true
      git -C "$ROOT" worktree add -b "$branch" "$dir" "$base" 2>/dev/null \
        || git -C "$ROOT" worktree add "$dir" "$branch"
      cp "$ROOT/apps/web/.env.local" "$dir/apps/web/.env.local" 2>/dev/null || true
      sed -i '' "s#localhost:3100#localhost:$port#g" "$dir/apps/web/.env.local" 2>/dev/null || true
      (cd "$dir" && pnpm install --prefer-offline >/dev/null 2>&1) && echo "deps instaladas"
    fi
    cat <<EOF

  worktree : $dir
  rama     : $branch  (base: $base)
  puerto   : $port
  arrancar : cd $dir && pnpm --filter @granola/web exec next dev -p $port
  agente   : cd $dir && codex   (o: claude)
  entregar : git push -u origin $branch && gh pr create --fill
EOF
    ;;
  lista)
    git -C "$ROOT" worktree list | while read -r path hash branch; do
      s=$(basename "$path"); [ "$path" = "$ROOT" ] && { echo "$path  main  (3100)"; continue; }
      echo "$path  $branch  ($(port_for "$s"))"
    done
    ;;
  borrar)
    [ -n "$slug" ] || { echo "uso: scripts/wt.sh borrar <slug>"; exit 1; }
    git -C "$ROOT" worktree remove --force "$WT_DIR/$slug" && git -C "$ROOT" branch -D "feature/$slug" || true
    echo "borrado $slug"
    ;;
  *) sed -n 2,9p "$0"; exit 1;;
esac
