#!/usr/bin/env bash
# scripts/compose-up-branch.sh
set -euo pipefail

show_usage() {
  echo
  echo "Usage: ./scripts/compose-up-branch.sh -production|-test|-empty [service ...]" >&2
  echo
  echo "Examples:"
  echo "  ./scripts/compose-up-branch.sh -test"
  echo "  ./scripts/compose-up-branch.sh -empty backend frontend"
  echo
}

production=false
test=false
empty=false
services=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -production|--production) production=true ;;
    -test|--test) test=true ;;
    -empty|--empty) empty=true ;;
    *) services+=("$1") ;;
  esac
  shift
done

mode_count=0
$production && ((mode_count++))
$test && ((mode_count++))
$empty && ((mode_count++))

if (( mode_count != 1 )); then
  echo "You must specify exactly one of: -production, -test, or -empty." >&2
  show_usage
  exit 1
fi

source "$(dirname "${BASH_SOURCE[0]}")/lib/branch-env.sh"
branch_env_load
cd "$REPO_ROOT"

echo "Starting '$BRANCH_NAME' with ports:"
echo "  DB: $DB_PORT"
echo "  Backend: $BACKEND_PORT"
echo "  Frontend: $FRONTEND_PORT"

if ! docker compose -p "$COMPOSE_PROJECT" up -d "${services[@]}"; then
  echo "Failed to start services." >&2
  exit 1
fi

if $empty; then
  echo "Starting with empty database."
  exit 0
fi

echo "Waiting for database to be ready..."
deadline=$((SECONDS + 120))
until docker compose -p "$COMPOSE_PROJECT" exec -T db pg_isready -U nutrition_user -d nutrition >/dev/null 2>&1; do
  if (( SECONDS >= deadline )); then
    echo "Database did not become ready within the timeout." >&2
    exit 1
  fi
  sleep 1
done

echo "Waiting for backend dependencies (alembic) to be ready..."
deadline=$((SECONDS + 180))
until docker compose -p "$COMPOSE_PROJECT" exec -T backend sh -lc 'python -m pip show alembic >/dev/null 2>&1'; do
  if (( SECONDS >= deadline )); then
    echo "Backend did not finish installing dependencies (alembic not available) within timeout." >&2
    exit 1
  fi
  sleep 1
done

echo "Applying database migrations..."
# Use python -m to avoid PATH inconsistencies for console scripts
docker compose -p "$COMPOSE_PROJECT" exec -T backend python -m alembic upgrade head

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
