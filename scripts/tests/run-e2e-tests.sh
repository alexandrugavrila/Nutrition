#!/usr/bin/env bash
# Run branch-isolated end-to-end suites by standing up a dedicated TEST stack
# with branch-specific TEST ports and tearing it down afterwards.

set -euo pipefail

show_usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/tests/run-e2e-tests.sh [pytest-args...]

Behavior:
  - Starts a dedicated test stack via
    ./scripts/docker/compose.sh up type -test data -test
    and reads branch-specific TEST ports from the generated env file
  - Waits for both backend and frontend to become healthy
  - Runs the backend API e2e pytest suite, then the browser-driven Playwright suite
    against the branch-isolated frontend
  - Additional CLI args are passed through to pytest

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

# Load shared helpers and branch env
# shellcheck disable=SC1090
source "$REPO_ROOT/scripts/lib/venv.sh"
source "$REPO_ROOT/scripts/lib/branch-env.sh"
source "$REPO_ROOT/scripts/lib/compose-utils.sh"
branch_env_load

# Invoke child bash scripts explicitly so the workflow survives non-executable
# shell scripts on cross-platform filesystems.

# Ensure the virtual environment is active
ensure_venv

is_backend_healthy() {
  local port="$1"
  curl -fsS --max-time 1 "http://localhost:${port}/api/ingredients" >/dev/null 2>&1
}

is_frontend_healthy() {
  local port="$1"
  curl -fsS --max-time 2 "http://localhost:${port}/" >/dev/null 2>&1
}

# Determine dedicated TEST compose project for this branch
TEST_PROJECT="$(compose_test_project)"

# Always start a dedicated TEST stack; capture resolved ports
ENV_FILE=$(mktemp)
cleanup_env() { rm -f "$ENV_FILE"; }
trap cleanup_env EXIT
COMPOSE_ENV_FILE="$ENV_FILE" bash ./scripts/docker/compose.sh up type -test data -test
# shellcheck disable=SC1090
source "$ENV_FILE"

# Ask docker for the published backend port for the test project
DEV_BACKEND_PORT=$(docker compose -p "$TEST_PROJECT" port backend 8000 2>/dev/null | awk -F: '{print $2}' || echo "$TEST_BACKEND_PORT")
DEV_FRONTEND_PORT=$(docker compose -p "$TEST_PROJECT" port frontend 3000 2>/dev/null | awk -F: '{print $2}' || echo "$TEST_FRONTEND_PORT")

# Wait for backend to become healthy (up to 120s)
echo "Checking backend health on port ${DEV_BACKEND_PORT}..."
deadline=$((SECONDS + 120))
until is_backend_healthy "$DEV_BACKEND_PORT"; do
  if (( SECONDS >= deadline )); then
    echo "Backend did not become healthy on port ${DEV_BACKEND_PORT} within timeout." >&2
    bash ./scripts/docker/compose.sh down type -test || true
    exit 1
  fi
  sleep 1
done

echo "Checking frontend health on port ${DEV_FRONTEND_PORT}..."
deadline=$((SECONDS + 180))
until is_frontend_healthy "$DEV_FRONTEND_PORT"; do
  if (( SECONDS >= deadline )); then
    echo "Frontend did not become healthy on port ${DEV_FRONTEND_PORT} within timeout." >&2
    bash ./scripts/docker/compose.sh down type -test || true
    exit 1
  fi
  sleep 1
done

echo "Installing Playwright browser runtime..."
npm --prefix Frontend run e2e:install >/dev/null

echo "Running API e2e tests against http://localhost:${DEV_BACKEND_PORT}/api"
set +e
DEV_BACKEND_PORT="$DEV_BACKEND_PORT" pytest -vv -rP -s -m e2e Backend/tests/test_e2e_api.py "$@"
api_exit=$?
echo "Running browser e2e tests against http://localhost:${DEV_FRONTEND_PORT}"
PLAYWRIGHT_BASE_URL="http://localhost:${DEV_FRONTEND_PORT}" \
DEV_BACKEND_PORT="$DEV_BACKEND_PORT" \
DEV_FRONTEND_PORT="$DEV_FRONTEND_PORT" \
npm --prefix Frontend run e2e
ui_exit=$?
set -e

# Tear down the dedicated TEST stack
bash ./scripts/docker/compose.sh down type -test

if [[ $api_exit -ne 0 ]]; then
  exit $api_exit
fi

exit $ui_exit
