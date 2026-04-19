#!/usr/bin/env bash
# Create a production database snapshot for the production compose stack.

set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/prod/backup.sh [--label <label>]

Creates a production PostgreSQL snapshot under Database/backups/production and
writes adjacent metadata describing the captured Alembic revision and image refs.
USAGE
}

LABEL="manual"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --label)
      shift
      LABEL="${1:-}"
      if [[ -z "$LABEL" ]]; then
        usage
        exit 1
      fi
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
  shift
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck disable=SC1090
source "$REPO_ROOT/scripts/lib/prod-compose.sh"

cd "$REPO_ROOT"

snapshot_path="$(prod_backup "$LABEL")"
echo "Snapshot dump:     $snapshot_path"
echo "Snapshot metadata: ${snapshot_path}.meta.json"
