#!/usr/bin/env bash
# Restore a PostgreSQL dump into the branch-local database.
set -euo pipefail

usage() {
  cat >&2 <<USAGE
Usage: $(basename "$0") [--upgrade-after] [--fail-on-mismatch] <dump_file>

Options:
  --upgrade-after      Run 'alembic -c Backend/alembic.ini upgrade head' after restore
  --fail-on-mismatch   Exit if backup Alembic revision doesn't match repo head(s)
USAGE
  exit 1
}

upgrade_after=false
fail_on_mismatch=false
args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --upgrade-after) upgrade_after=true; shift;;
    --fail-on-mismatch) fail_on_mismatch=true; shift;;
    -h|--help) usage;;
    --*) echo "Unknown option: $1" >&2; usage;;
    *) args+=("$1"); shift;;
  esac
done

if [[ ${#args[@]} -ne 1 ]]; then
  usage
fi

dump_file="${args[0]}"
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

# Print backup Alembic version and compare with repo head(s) if possible
backup_version="unknown"
meta_file="${dump_file}.meta.json"
if [[ -f "$meta_file" ]]; then
  if command -v jq >/dev/null 2>&1; then
    set +e
    backup_version=$(jq -r '.alembic_version // "unknown"' "$meta_file" 2>/dev/null)
    set -e
  else
    # Fallback: naive grep/sed (expects simple JSON produced by our backup script)
    set +e
    backup_version=$(grep -o '"alembic_version"[^"]*"[^"]*"' "$meta_file" | sed 's/.*"alembic_version"[^"]*"\([^"]*\)"/\1/' 2>/dev/null)
    set -e
    [[ -z "$backup_version" ]] && backup_version="unknown"
  fi
fi

repo_heads=""
if command -v python >/dev/null 2>&1; then
  set +e
  repo_heads=$(python - <<'PY'
from alembic.config import Config
from alembic.script import ScriptDirectory
try:
    cfg = Config('Backend/alembic.ini')
    script = ScriptDirectory.from_config(cfg)
    print(','.join(script.get_heads()))
except Exception:
    pass
PY
  )
  set -e
fi

echo "Backup Alembic revision: $backup_version"
if [[ -n "$repo_heads" ]]; then
  echo "Repo head(s): $repo_heads"
  if [[ -n "$backup_version" && "$repo_heads" != *"$backup_version"* ]]; then
    echo "Warning: backup revision differs from repo head(s)." >&2
    if $fail_on_mismatch; then
      echo "Failing due to --fail-on-mismatch." >&2
      exit 2
    fi
  fi
fi

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$dump_file"

if $upgrade_after; then
  if command -v alembic >/dev/null 2>&1; then
    echo "Running 'alembic -c Backend/alembic.ini upgrade head' after restore..."
    alembic -c Backend/alembic.ini upgrade head
  else
    echo "Alembic not found on PATH; skipping upgrade. Install backend deps to enable this." >&2
  fi
fi

