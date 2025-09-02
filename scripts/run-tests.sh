#!/usr/bin/env bash
# Run backend and frontend tests, with optional model sync and e2e tests.

set -euo pipefail

show_usage() {
  cat <<'USAGE'
Usage: ./scripts/run-tests.sh [--e2e] [--sync] [--full]

Runs backend (pytest) and frontend (npm test) suites.
  --e2e    Also run end-to-end API tests via scripts/tests/run-e2e-tests.sh
  --sync   Run model/API sync (OpenAPI + frontend types + migration drift)
  --full   Equivalent to --sync and --e2e
USAGE
}

RUN_E2E=false
RUN_SYNC=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --e2e)
      RUN_E2E=true
      shift
      ;;
    --sync)
      RUN_SYNC=true
      shift
      ;;
    --full)
      RUN_E2E=true
      RUN_SYNC=true
      shift
      ;;
    -h|--help)
      show_usage
      exit 0
      ;;
    *)
      show_usage >&2
      exit 1
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Ensure virtual environment is active (activate only if not already)
if [[ -z "${VIRTUAL_ENV:-}" ]]; then
  echo "No virtualenv detected; activating via ./scripts/env/activate-venv.sh ..."
  # shellcheck disable=SC1090
  source "$REPO_ROOT/scripts/env/activate-venv.sh"
else
  echo "Using existing virtualenv: $VIRTUAL_ENV"
fi

# Optional: synchronize OpenAPI + migrations (non-interactive)
if $RUN_SYNC; then
  echo "Synchronizing API schema and database migrations..."
  "$REPO_ROOT/scripts/db/sync-api-and-migrations.sh" -y
fi

# Backend tests (exclude e2e by default; use --e2e to include)
# Force an isolated test database so unit tests never touch the dev DB.
DATABASE_URL=sqlite:// pytest -m 'not e2e'

# Frontend tests
CI=true npm --prefix Frontend test

# Optional end-to-end tests
if $RUN_E2E; then
  "$REPO_ROOT/scripts/tests/run-e2e-tests.sh"
fi
