#!/usr/bin/env bash
# Apply Alembic migrations against the running branch-specific stack.
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: migrate.sh [--allow-non-local-db]

Options:
  --allow-non-local-db  Allow migrations when DATABASE_URL is not localhost.
USAGE
}

allow_non_local=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --allow-non-local-db) allow_non_local=true ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac
  shift
done

source "$(dirname "${BASH_SOURCE[0]}")/../lib/branch-env.sh"
branch_env_load
source "$(dirname "${BASH_SOURCE[0]}")/../lib/compose-utils.sh"
cd "$REPO_ROOT"

require_branch_containers

if [[ "$DATABASE_URL" != *"localhost"* && "$allow_non_local" != true ]]; then
  echo "Refusing to migrate non-local database without --allow-non-local-db." >&2
  exit 1
fi

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
docker compose -p "$COMPOSE_PROJECT" exec -T backend sh -lc "cd /app/Backend && python -m alembic -c alembic.ini upgrade head"
echo "Migrations complete."
