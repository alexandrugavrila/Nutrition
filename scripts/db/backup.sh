#!/usr/bin/env bash
# Create a timestamped PostgreSQL dump for the branch-local database.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/../lib/branch-env.sh"
branch_env_load
cd "$REPO_ROOT"

# Ensure containers are running for this branch
if [[ -z $(docker compose -p "$COMPOSE_PROJECT" ps -q 2>/dev/null) ]]; then
  echo "Warning: no containers running for branch '$BRANCH_NAME'. Run the compose script first." >&2
  exit 1
fi

mkdir -p Database/backups
timestamp=$(date +"%Y%m%d-%H%M%S")
dump_path="Database/backups/${BRANCH_SANITIZED}-${timestamp}.dump"
pg_dump --format=custom --no-owner --no-privileges --file="$dump_path" "$DATABASE_URL"
echo "Wrote backup to $dump_path"
