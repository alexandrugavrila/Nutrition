#!/usr/bin/env bash
# Run Alembic migrations against the production compose stack.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck disable=SC1090
source "$REPO_ROOT/scripts/lib/prod-compose.sh"

cd "$REPO_ROOT"

echo "Ensuring the production database service is running..."
prod_compose up -d db
prod_wait_for_service db 180

prod_run_migration

echo "Production migrations complete."
