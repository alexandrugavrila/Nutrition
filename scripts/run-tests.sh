#!/usr/bin/env bash
# Run backend and frontend tests, optionally including end-to-end tests.

set -euo pipefail

show_usage() {
  cat <<'USAGE'
Usage: ./scripts/run-tests.sh [--e2e]

Runs backend (pytest) and frontend (npm test) suites.
  --e2e   Also run end-to-end API tests via scripts/tests/run-e2e-tests.sh
USAGE
}

RUN_E2E=false
if [[ $# -gt 0 ]]; then
  if [[ "$1" == "--e2e" ]]; then
    RUN_E2E=true
    shift
  else
    show_usage >&2
    exit 1
  fi
fi

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

# Backend tests (exclude e2e by default; use --e2e to include)
# Force an isolated test database so unit tests never touch the dev DB.
DATABASE_URL=sqlite:// pytest -m 'not e2e'

# Frontend tests
CI=true npm --prefix Frontend test

# Optional end-to-end tests
if $RUN_E2E; then
  "$REPO_ROOT/scripts/tests/run-e2e-tests.sh"
fi
