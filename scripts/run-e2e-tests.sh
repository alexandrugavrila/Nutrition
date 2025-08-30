#!/usr/bin/env bash
# Run end-to-end API tests. If the branch-specific stack is not up/healthy,
# spin it up in -test mode and wait until the backend is reachable.

set -euo pipefail

show_usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/run-e2e-tests.sh [pytest-args...]

Behavior:
  - If BACKEND_PORT is unset or backend is unreachable, starts the stack via
    ./scripts/compose-up-branch.sh -test
  - Waits for the backend to become healthy
  - Runs: pytest -vv -rP -s -m e2e Backend/tests/test_e2e_api.py [pytest-args]

Examples:
  ./scripts/run-e2e-tests.sh -q
  ./scripts/run-e2e-tests.sh -k ingredient
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  show_usage
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

is_backend_healthy() {
  local port="$1"
  # Use a lightweight endpoint; follow redirects if trailing slash differs
  curl -fsS --max-time 1 "http://localhost:${port}/api/ingredients" >/dev/null 2>&1
}

STARTED_STACK=false

if [[ -z "${BACKEND_PORT:-}" ]] || ! is_backend_healthy "$BACKEND_PORT"; then
  # Bring up the stack to ensure ports are exported and services are running
  # shellcheck disable=SC1091
  source ./scripts/compose-up-branch.sh -test
  STARTED_STACK=true
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

# Note: intentionally leave the stack running. Use compose-down-branch when done.
exit $?
