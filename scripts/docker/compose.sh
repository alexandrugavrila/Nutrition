#!/usr/bin/env bash
# scripts/docker/compose.sh
set -euo pipefail

show_usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/docker/compose.sh <subcommand> [options]

Subcommands:
  up [type <-dev|-test>] data <-test|-prod> [service...]
  down [type <-dev|-test>]
  restart [type <-dev|-test>] data <-test|-prod>
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
  local use_test_ports=false data_mode=""
  local services=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      type) shift; case "${1:-}" in -test) use_test_ports=true ;; -dev) use_test_ports=false ;; *) echo "Error: type expects -test or -dev" >&2; return 1 ;; esac ;;
      data) shift; case "${1:-}" in -test) data_mode="test" ;; -prod) data_mode="prod" ;; *) echo "Error: data expects -test|-prod" >&2; return 1 ;; esac ;;
      *) services+=("$1") ;;
    esac
    shift
  done
  if [[ -z "$data_mode" ]]; then
    echo "Missing required 'data' selection. Usage: up [type <-dev|-test>] data <-test|-prod>" >&2
    return 1
  fi
  local proj
  if $use_test_ports; then
    proj="${COMPOSE_PROJECT}-test"
  else
    proj="$COMPOSE_PROJECT"
  fi

  # If requested, publish on testing ports and point host DATABASE_URL at them
  if $use_test_ports; then
    DEV_DB_PORT="$TEST_DB_PORT"
    DEV_BACKEND_PORT="$TEST_BACKEND_PORT"
    DEV_FRONTEND_PORT="$TEST_FRONTEND_PORT"
    DATABASE_URL="postgresql://nutrition_user:nutrition_pass@localhost:${DEV_DB_PORT}/nutrition"
    export DEV_DB_PORT DEV_BACKEND_PORT DEV_FRONTEND_PORT DATABASE_URL
  fi

  echo "Starting '$BRANCH_NAME' as project '$proj' with ports:"
  echo "  DB: $DEV_DB_PORT"
  echo "  Backend: $DEV_BACKEND_PORT"
  echo "  Frontend: $DEV_FRONTEND_PORT"

  if ! docker compose -p "$proj" up -d "${services[@]}"; then
    echo "Failed to start services." >&2
    return 1
  fi

  echo "Waiting for database to be ready..."
  local deadline=$((SECONDS + 120))
  until docker compose -p "$proj" exec -T db pg_isready -U nutrition_user -d nutrition >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      echo "Database did not become ready within the timeout." >&2
      return 1
    fi
    sleep 1
  done

  echo "Waiting for backend dependencies (alembic) to be ready..."
  deadline=$((SECONDS + 180))
  until docker compose -p "$proj" exec -T backend sh -lc 'python -m pip show alembic >/dev/null 2>&1'; do
    if (( SECONDS >= deadline )); then
      echo "Backend did not finish installing dependencies (alembic not available) within timeout." >&2
      return 1
    fi
    sleep 1
  done

  echo "Applying database migrations..."
  docker compose -p "$proj" exec -T backend python -m alembic upgrade head
  ./scripts/env/activate-venv.sh
  if [[ "$data_mode" == "prod" ]]; then
    echo "Importing production data..."
    python Database/import_from_csv.py --production
  else
    echo "Importing test data..."
    python Database/import_from_csv.py --test
  fi

  echo "Done."
}

# Helpers for selecting and removing compose projects
compose_down() {
  local use_test_ports=false
  while [[ $# -gt 0 ]]; do
    case "$1" in
      type)
        shift
        case "${1:-}" in
          -test) use_test_ports=true ;;
          -dev) use_test_ports=false ;;
          *) echo "Error: type expects -test or -dev" >&2; return 1 ;;
        esac
        ;;
      *) echo "Usage: ./scripts/docker/compose.sh down [type <-dev|-test>]" >&2; return 1 ;;
    esac
    shift
  done
  local proj
  if $use_test_ports; then proj="${COMPOSE_PROJECT}-test"; else proj="$COMPOSE_PROJECT"; fi
  echo "Bringing down '$proj'..."
  docker compose -p "$proj" down -v --remove-orphans >/dev/null 2>&1 || true
  docker network rm "${proj}_default" >/dev/null 2>&1 || true
  docker volume rm "${proj}_node_modules" >/dev/null 2>&1 || true
  echo "Done."
}

compose_restart() {
  local use_test_ports=false data_mode=""
  local args=( )
  while [[ $# -gt 0 ]]; do
    case "$1" in
      type) shift; case "${1:-}" in -test) use_test_ports=true ;; -dev) use_test_ports=false ;; *) echo "Error: type expects -test or -dev" >&2; return 1 ;; esac ;;
      data) shift; case "${1:-}" in -test) data_mode="test" ;; -prod) data_mode="prod" ;; *) echo "Error: data expects -test|-prod" >&2; return 1 ;; esac ;;
      *) args+=("$1") ;;
    esac
    shift
  done
  if [[ -z "$data_mode" ]]; then
    echo "restart requires: data <-test|-prod> (optionally type <-dev|-test>)" >&2
    return 1
  fi
  local proj
  if $use_test_ports; then
    proj="${COMPOSE_PROJECT}-test"
  else
    proj="$COMPOSE_PROJECT"
  fi
  echo "Bringing down containers for project '$proj'..."
  docker compose -p "$proj" down -v --remove-orphans >/dev/null 2>&1 || true
  docker network rm "${proj}_default" >/dev/null 2>&1 || true
  docker volume rm "${proj}_node_modules" >/dev/null 2>&1 || true
  local next_args=( )
  $use_test_ports && next_args+=(type -test)
  next_args+=(data "-${data_mode}")
  compose_up "${next_args[@]}" "${args[@]}"
}

case "${1:-}" in
  up) shift; compose_up "$@" ;;
  down) shift; compose_down "$@" ;;
  restart) shift; compose_restart "$@" ;;
  *) show_usage; return 1 2>/dev/null || exit 1 ;;
esac
