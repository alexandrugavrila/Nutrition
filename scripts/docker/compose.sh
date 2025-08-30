#!/usr/bin/env bash
# scripts/docker/compose.sh
set -euo pipefail

show_usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/docker/compose.sh <subcommand> [options]

Subcommands:
  up [-production|-test|-empty] [service...]
  down [--prune-images] [--force] [--all|--project <name>]
  restart [-production|-test|-empty] [service...]
USAGE
}

# Load branch-specific environment variables
source "$(dirname "${BASH_SOURCE[0]}")/../lib/branch-env.sh"
branch_env_load

# If a path is provided, export resolved ports for downstream scripts.
if [[ -n "${COMPOSE_ENV_FILE:-}" ]]; then
  cat >"$COMPOSE_ENV_FILE" <<EOF
DEV_DB_PORT=$DEV_DB_PORT
DEV_BACKEND_PORT=$DEV_BACKEND_PORT
DEV_FRONTEND_PORT=$DEV_FRONTEND_PORT
TEST_DB_PORT=$TEST_DB_PORT
TEST_BACKEND_PORT=$TEST_BACKEND_PORT
TEST_FRONTEND_PORT=$TEST_FRONTEND_PORT
EOF
fi

cd "$REPO_ROOT"

# --- Helper functions shared across subcommands ---

compose_up() {
  local production=false test=false empty=false
  local services=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -production|--production) production=true ;;
      -test|--test) test=true ;;
      -empty|--empty) empty=true ;;
      *) services+=("$1") ;;
    esac
    shift
  done
  local mode_count=0
  $production && ((mode_count++))
  $test && ((mode_count++))
  $empty && ((mode_count++))
  if (( mode_count != 1 )); then
    echo "You must specify exactly one of: -production, -test, or -empty." >&2
    return 1
  fi

  echo "Starting '$BRANCH_NAME' with ports:"
  echo "  DB: $DEV_DB_PORT"
  echo "  Backend: $DEV_BACKEND_PORT"
  echo "  Frontend: $DEV_FRONTEND_PORT"

  if ! docker compose -p "$COMPOSE_PROJECT" up -d "${services[@]}"; then
    echo "Failed to start services." >&2
    return 1
  fi

  if $empty; then
    echo "Starting with empty database."
    return 0
  fi

  echo "Waiting for database to be ready..."
  local deadline=$((SECONDS + 120))
  until docker compose -p "$COMPOSE_PROJECT" exec -T db pg_isready -U nutrition_user -d nutrition >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      echo "Database did not become ready within the timeout." >&2
      return 1
    fi
    sleep 1
  done

  echo "Waiting for backend dependencies (alembic) to be ready..."
  deadline=$((SECONDS + 180))
  until docker compose -p "$COMPOSE_PROJECT" exec -T backend sh -lc 'python -m pip show alembic >/dev/null 2>&1'; do
    if (( SECONDS >= deadline )); then
      echo "Backend did not finish installing dependencies (alembic not available) within timeout." >&2
      return 1
    fi
    sleep 1
  done

  echo "Applying database migrations..."
  docker compose -p "$COMPOSE_PROJECT" exec -T backend python -m alembic upgrade head

  if $production || $test; then
    ./scripts/env/activate-venv.sh
    if $production; then
      echo "Importing production data..."
      python Database/import_from_csv.py --production
    else
      echo "Importing test data..."
      python Database/import_from_csv.py --test
    fi
  fi

  echo "Done."
}

# Helpers for selecting and removing compose projects
get_compose_projects() {
  local prefix=${1:-nutrition-}
  local projects="" json
  json=$(docker compose ls --format json 2>/dev/null || true)
  if [[ -n "$json" ]]; then
    projects=$(echo "$json" | python - <<'PY'
import sys,json
try:
  items=json.load(sys.stdin)
  for it in items:
    name=it.get('Name')
    if name:
      print(name)
except Exception:
  pass
PY
    )
    projects=$(echo "$projects" | grep "^$prefix" || true)
  fi
  if [[ -z "$projects" ]]; then
    projects=$(docker ps -a --format '{{.Label "com.docker.compose.project"}}' 2>/dev/null | grep "^$prefix" | sort -u || true)
  fi
  echo "$projects"
}

prioritize_current_branch() {
  local projects=("$@")
  local current="nutrition-$BRANCH_SANITIZED"
  if printf '%s\n' "${projects[@]}" | grep -qx "$current"; then
    echo "$current"
    for p in "${projects[@]}"; do
      [[ "$p" == "$current" ]] || echo "$p"
    done
    return
  fi
  printf '%s\n' "${projects[@]}"
}

select_projects() {
  local projects=("$@")
  if [[ ${#projects[@]} -eq 0 ]]; then
    echo "No Compose projects found with the expected prefix." >&2
    return
  fi
  echo "Select project(s) to delete:"
  for i in "${!projects[@]}"; do
    printf "%2d) %s\n" $((i+1)) "${projects[i]}"
  done
  read -r -p "Enter space-separated numbers or 'all': " input
  [[ -z "$input" ]] && return
  if [[ "$input" == "all" ]]; then
    printf '%s\n' "${projects[@]}"
    return
  fi
  local selection=()
  for idx in $input; do
    if [[ "$idx" =~ ^[0-9]+$ ]] && (( idx>=1 && idx<=${#projects[@]} )); then
      selection+=("${projects[idx-1]}")
    fi
  done
  printf '%s\n' "${selection[@]}" | sort -u
}

compose_down() {
  local prune_images=false force=false all=false project=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prune-images) prune_images=true ;;
      --force) force=true ;;
      --all) all=true ;;
      --project)
        shift
        project="${1:-}"
        if [[ -z "$project" ]]; then
          echo "Error: --project requires a name" >&2
          return 1
        fi
        ;;
      *) echo "Usage: ./scripts/docker/compose.sh down [--prune-images] [--force] [--all|--project <name>]" >&2; return 1 ;;
    esac
    shift
  done

  local -a chosen=()
  if $all; then
    mapfile -t projects < <(get_compose_projects)
    mapfile -t projects < <(prioritize_current_branch "${projects[@]}")
    if [[ ${#projects[@]} -eq 0 ]]; then
      echo "No Compose projects found with the expected prefix." >&2
      return 0
    fi
    chosen=("${projects[@]}")
  elif [[ -n "$project" ]]; then
    chosen=("$project")
  else
    chosen=("$COMPOSE_PROJECT")
  fi

  if ! $force && (( ${#chosen[@]} > 1 )); then
    echo "You are about to delete the following Compose project(s):"
    for p in "${chosen[@]}"; do
      echo "  - $p"
    done
    read -r -p "Type 'yes' to proceed: " confirm
    if [[ "$confirm" != "yes" ]]; then
      echo "Cancelled."
      return 0
    fi
  fi

  for proj in "${chosen[@]}"; do
    echo "Bringing down '$proj'..."
    args=(compose -p "$proj" down -v --remove-orphans)
    $prune_images && args+=(--rmi local)
    docker "${args[@]}"
    local defaultNet="${proj}_default"
    docker network rm "$defaultNet" >/dev/null 2>&1 || true
    docker volume rm "${proj}_node_modules" >/dev/null 2>&1 || true
  done

  echo "Done."
}

compose_restart() {
  echo "Bringing down containers for '$BRANCH_NAME'..."
  docker compose -p "$COMPOSE_PROJECT" down -v --remove-orphans >/dev/null 2>&1 || true
  docker network rm "${COMPOSE_PROJECT}_default" >/dev/null 2>&1 || true
  docker volume rm "${COMPOSE_PROJECT}_node_modules" >/dev/null 2>&1 || true
  compose_up "$@"
}

case "${1:-}" in
  up) shift; compose_up "$@" ;;
  down) shift; compose_down "$@" ;;
  restart) shift; compose_restart "$@" ;;
  *) show_usage; return 1 2>/dev/null || exit 1 ;;
esac
