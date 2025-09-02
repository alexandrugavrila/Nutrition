#!/usr/bin/env bash
# Restore a PostgreSQL dump into the branch-local database.
set -euo pipefail

usage() {
  echo "Usage: $(basename "$0") <dump_file>" >&2
  exit 1
}

if [[ $# -ne 1 ]]; then
  usage
fi

dump_file="$1"
if [[ ! -f "$dump_file" ]]; then
  echo "Dump file '$dump_file' not found" >&2
  exit 1
fi

source "$(dirname "${BASH_SOURCE[0]}")/../lib/branch-env.sh"
branch_env_load
cd "$REPO_ROOT"

case "$DATABASE_URL" in
  postgresql://*localhost*|postgres://*localhost*)
    ;;
  *)
    echo "Refusing to restore to non-localhost database" >&2
    exit 1
    ;;
esac

if [[ -z $(docker compose -p "$COMPOSE_PROJECT" ps -q 2>/dev/null) ]]; then
  echo "Warning: no containers running for branch '$BRANCH_NAME'. Run the compose script first." >&2
  exit 1
fi

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$dump_file"
