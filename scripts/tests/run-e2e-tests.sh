#!/usr/bin/env bash
# Run end-to-end API tests. If the branch-specific stack is not up/healthy,
# spin it up in -test mode and wait until the backend is reachable.

set -euo pipefail

show_usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/tests/run-e2e-tests.sh [pytest-args...]

Behavior:
  - Uses docker compose to determine the backend port for the current branch
  - If the backend is unreachable, starts the stack via ./scripts/docker/compose.sh up -test
    and reads port information from the generated env file
  - Waits for the backend to become healthy
  - Runs: pytest -vv -rP -s -m e2e Backend/tests/test_e2e_api.py [pytest-args]

Examples:
  ./scripts/tests/run-e2e-tests.sh -q
  ./scripts/tests/run-e2e-tests.sh -k ingredient
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  show_usage
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# Ensure the virtual environment is active
if [[ -z "${VIRTUAL_ENV:-}" ]]; then
  echo "No virtualenv detected; activating via ./scripts/env/activate-venv.sh ..."
  if ! source ./scripts/env/activate-venv.sh >/tmp/venv.log 2>&1; then
    cat /tmp/venv.log
    echo "Failed to activate virtual environment" >&2
    exit 1
  fi
fi

is_backend_healthy() {
  local port="$1"
  curl -fsS --max-time 1 "http://localhost:${port}/api/ingredients" >/dev/null 2>&1
}

# Determine compose project for this branch
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD | tr -d '\n')
BRANCH_SANITIZED=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/^[-]*//;s/[-]*$//')
COMPOSE_PROJECT="nutrition-$BRANCH_SANITIZED"

# Attempt to read existing backend port
BACKEND_PORT=$(docker compose -p "$COMPOSE_PROJECT" port backend 8000 2>/dev/null | awk -F: '{print $2}' || true)

if [[ -z "$BACKEND_PORT" ]] || ! is_backend_healthy "$BACKEND_PORT"; then
  ENV_FILE=$(mktemp)
  trap 'rm -f "$ENV_FILE"' EXIT
  COMPOSE_ENV_FILE="$ENV_FILE" ./scripts/docker/compose.sh up -test
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  rm -f "$ENV_FILE"
  BACKEND_PORT="$BACKEND_PORT"
fi

# Wait for backend to become healthy (up to 120s)
echo "Checking backend health on port ${BACKEND_PORT}..."
deadline=$((SECONDS + 120))
until is_backend_healthy "$BACKEND_PORT"; do
  if (( SECONDS >= deadline )); then
    echo "Backend did not become healthy on port ${BACKEND_PORT} within timeout." >&2
    exit 1
  fi
  sleep 1
done

echo "Running e2e tests against http://localhost:${BACKEND_PORT}/api"
pytest -vv -rP -s -m e2e Backend/tests/test_e2e_api.py "$@"

# Note: intentionally leave the stack running. Use scripts/docker/compose.sh down when done.
exit $?
