#!/usr/bin/env bash
# Create a timestamped PostgreSQL dump for the branch-local database.
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/../lib/branch-env.sh"
branch_env_load
source "$(dirname "${BASH_SOURCE[0]}")/../lib/compose-utils.sh"
cd "$REPO_ROOT"

# Ensure containers are running for this branch
require_branch_containers

mkdir -p Database/backups
timestamp=$(date +"%Y%m%d-%H%M%S")
dump_path="Database/backups/${BRANCH_SANITIZED}-${timestamp}.dump"
pg_dump --format=custom --no-owner --no-privileges --file="$dump_path" "$DATABASE_URL"
echo "Wrote backup to $dump_path"

# Capture Alembic version and git commit for traceability
alembic_version=""
if command -v psql >/dev/null 2>&1; then
  set +e
  alembic_version=$(psql "$DATABASE_URL" -Atc "SELECT version_num FROM alembic_version LIMIT 1;" 2>/dev/null)
  set -e
fi
if [[ -z "$alembic_version" ]]; then
  alembic_version="unknown"
fi

git_commit="unknown"
if command -v git >/dev/null 2>&1; then
  set +e
  git_commit=$(git rev-parse --short HEAD 2>/dev/null)
  if [[ -z "$git_commit" ]]; then git_commit="unknown"; fi
  set -e
fi

meta_path="${dump_path}.meta.json"
{
  echo "{"
  echo "  \"alembic_version\": \"$alembic_version\","
  echo "  \"git_commit\": \"$git_commit\","
  echo "  \"branch\": \"$BRANCH_NAME\","
  echo "  \"timestamp\": \"$timestamp\""
  echo "}"
} > "$meta_path"
echo "Wrote metadata to $meta_path (alembic_version=$alembic_version)"
