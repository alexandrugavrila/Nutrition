#!/usr/bin/env bash
# Run end-to-end API tests by standing up a dedicated TEST stack
# with branch-specific TEST ports and tearing it down afterwards.

set -euo pipefail

show_usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/tests/run-e2e-tests.sh [pytest-args...]

Behavior:
  - Uses docker compose to determine the backend port for the current branch
  - If the backend is unreachable, starts a dedicated test stack via
    ./scripts/docker/compose.sh up type -test data -test
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

# Determine dedicated TEST compose project for this branch
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD | tr -d '\n')
BRANCH_SANITIZED=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/^[-]*//;s/[-]*$//')
TEST_PROJECT="nutrition-${BRANCH_SANITIZED}-test"

# Always start a dedicated TEST stack; capture resolved ports
ENV_FILE=$(mktemp)
cleanup_env() { rm -f "$ENV_FILE"; }
trap cleanup_env EXIT
COMPOSE_ENV_FILE="$ENV_FILE" ./scripts/docker/compose.sh up type -test data -test
# shellcheck disable=SC1090
source "$ENV_FILE"

# Ask docker for the published backend port for the test project
DEV_BACKEND_PORT=$(docker compose -p "$TEST_PROJECT" port backend 8000 2>/dev/null | awk -F: '{print $2}' || echo "$TEST_BACKEND_PORT")

# Wait for backend to become healthy (up to 120s)
echo "Checking backend health on port ${DEV_BACKEND_PORT}..."
deadline=$((SECONDS + 120))
until is_backend_healthy "$DEV_BACKEND_PORT"; do
  if (( SECONDS >= deadline )); then
    echo "Backend did not become healthy on port ${DEV_BACKEND_PORT} within timeout." >&2
    ./scripts/docker/compose.sh down --project "$TEST_PROJECT" --force || true
    exit 1
  fi
  sleep 1
done

echo "Running e2e tests against http://localhost:${DEV_BACKEND_PORT}/api"
set +e
DEV_BACKEND_PORT="$DEV_BACKEND_PORT" pytest -vv -rP -s -m e2e Backend/tests/test_e2e_api.py "$@"
test_exit=$?
set -e

# Tear down the dedicated TEST stack
./scripts/docker/compose.sh down type -test
exit $test_exit
