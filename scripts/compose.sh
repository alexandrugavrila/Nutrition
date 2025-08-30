#!/usr/bin/env bash
# scripts/compose.sh
set -euo pipefail

show_usage() {
  cat <<'USAGE'
Usage: ./scripts/compose.sh <subcommand> [options] [service ...]

Subcommands:
  up       - start services (-production|-test|-empty)
  down     - stop services [--prune-images] [--force]
  restart  - restart services (-production|-test|-empty)

Examples:
  ./scripts/compose.sh up -test
  ./scripts/compose.sh down --prune-images
  ./scripts/compose.sh restart -empty backend frontend
USAGE
}

# Helper functions reused across subcommands
get_branch() { git rev-parse --abbrev-ref HEAD | tr -d '\n'; }
sanitize_branch() { echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/^[-]*//;s/[-]*$//'; }
get_project() { local branch="$(get_branch)"; local san="$(sanitize_branch "$branch")"; echo "nutrition-$san"; }
export_branch_ports() {
  local branch="$(get_branch)"; local offset_hex="$(printf '%s' "$branch" | sha1sum | head -c 2)"; local offset=$((0x$offset_hex % 100))
  export DB_PORT=$((5432 + offset))
  export BACKEND_PORT=$((8000 + offset))
  export FRONTEND_PORT=$((3000 + offset))
  export DATABASE_URL="postgresql://nutrition_user:nutrition_pass@localhost:$DB_PORT/nutrition"
}

compose_up() {
  local production=false test=false empty=false services=()
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

  local repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$repo_root"

  local branch="$(get_branch)"
  local project="$(get_project)"
  export_branch_ports

  echo "Starting '$branch' with ports:"
  echo "  DB: $DB_PORT"
  echo "  Backend: $BACKEND_PORT"
  echo "  Frontend: $FRONTEND_PORT"

  if ! docker compose -p "$project" up -d "${services[@]}"; then
    echo "Failed to start services." >&2
    return 1
  fi

  if $empty; then
    echo "Starting with empty database."
    return 0
  fi

  echo "Waiting for database to be ready..."
  local deadline=$((SECONDS + 120))
  until docker compose -p "$project" exec -T db pg_isready -U nutrition_user -d nutrition >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      echo "Database did not become ready within the timeout." >&2
      return 1
    fi
    sleep 1
  done

  echo "Waiting for backend dependencies (alembic) to be ready..."
  deadline=$((SECONDS + 180))
  until docker compose -p "$project" exec -T backend sh -lc 'python -m pip show alembic >/dev/null 2>&1'; do
    if (( SECONDS >= deadline )); then
      echo "Backend did not finish installing dependencies (alembic not available) within timeout." >&2
      return 1
    fi
    sleep 1
  done

  echo "Applying database migrations..."
  docker compose -p "$project" exec -T backend python -m alembic upgrade head

  if $production || $test; then
    ./scripts/activate-venv.sh
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
  local branch="$(get_branch)"
  if [[ -n "$branch" ]]; then
    local san="$(sanitize_branch "$branch")"
    local current="nutrition-$san"
    if printf '%s\n' "${projects[@]}" | grep -qx "$current"; then
      echo "$current"
      for p in "${projects[@]}"; do
        [[ "$p" == "$current" ]] || echo "$p"
      done
      return
    fi
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
  local prune_images=false force=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --prune-images) prune_images=true ;;
      --force) force=true ;;
      *) echo "Usage: ./scripts/compose.sh down [--prune-images] [--force]" >&2; return 1 ;;
    esac
    shift
  done

  local repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$repo_root"

  mapfile -t projects < <(get_compose_projects)
  mapfile -t projects < <(prioritize_current_branch "${projects[@]}")

  [[ ${#projects[@]} -eq 0 ]] && return 0

  mapfile -t chosen < <(select_projects "${projects[@]}")
  if [[ ${#chosen[@]} -eq 0 ]]; then
    echo "Nothing selected. Exiting."
    return 0
  fi

  if ! $force; then
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
    defaultNet="${proj}_default"
    docker network rm "$defaultNet" >/dev/null 2>&1 || true
    docker volume rm "${proj}_node_modules" >/dev/null 2>&1 || true
  done

  echo "Done."
}

compose_restart() {
  local repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  cd "$repo_root"
  local branch="$(get_branch)"
  local project="$(get_project)"
  echo "Bringing down containers for '$branch'..."
  docker compose -p "$project" down -v --remove-orphans >/dev/null 2>&1 || true
  docker network rm "${project}_default" >/dev/null 2>&1 || true
  docker volume rm "${project}_node_modules" >/dev/null 2>&1 || true
  compose_up "$@"
}

main() {
  local subcommand="${1:-}"
  if [[ -z "$subcommand" ]]; then
    show_usage
    return 1
  fi
  shift || true
  case "$subcommand" in
    up) compose_up "$@" ;;
    down) compose_down "$@" ;;
    restart) compose_restart "$@" ;;
    *) show_usage; return 1 ;;
  esac
}

main "$@"
