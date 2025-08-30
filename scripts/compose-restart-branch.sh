#!/usr/bin/env bash
# scripts/compose-restart-branch.sh
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/lib/branch-env.sh"
branch_env_load
cd "$REPO_ROOT"

echo "Bringing down containers for '$BRANCH_NAME'..."
docker compose -p "$COMPOSE_PROJECT" down -v --remove-orphans >/dev/null 2>&1 || true
docker network rm "${COMPOSE_PROJECT}_default" >/dev/null 2>&1 || true
docker volume rm "${COMPOSE_PROJECT}_node_modules" >/dev/null 2>&1 || true

echo "Bringing up containers..."
"$REPO_ROOT/scripts/compose-up-branch.sh" "$@"
