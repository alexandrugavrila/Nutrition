#!/usr/bin/env bash
# Restore a PostgreSQL dump into the branch-local database.
set -euo pipefail

usage() {
  cat >&2 <<USAGE
Usage: $(basename "$0") [--upgrade-after] [--fail-on-mismatch] [--reset-schema] [dump_file]

Options:
  --upgrade-after      Run 'alembic -c Backend/alembic.ini upgrade head' after restore
  --fail-on-mismatch   Exit if backup Alembic revision doesn't match repo head(s)
  --reset-schema       Drop and recreate 'public' schema before restore (dev-safe)

Notes:
  When 'dump_file' is omitted, the script auto-selects the most recent backup for
  the current branch from Database/backups/.
USAGE
  exit 1
}

upgrade_after=false
fail_on_mismatch=false
reset_schema=false
args=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --upgrade-after) upgrade_after=true; shift;;
    --fail-on-mismatch) fail_on_mismatch=true; shift;;
    --reset-schema) reset_schema=true; shift;;
    -h|--help) usage;;
    --*) echo "Unknown option: $1" >&2; usage;;
    *) args+=("$1"); shift;;
  esac
done

# Load branch env early to enable auto-selection when no file is provided
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/branch-env.sh"
branch_env_load
source "$SCRIPT_DIR/../lib/compose-utils.sh"
cd "$REPO_ROOT"

dump_file=""
if [[ ${#args[@]} -gt 1 ]]; then
  usage
elif [[ ${#args[@]} -eq 1 ]]; then
  dump_file="${args[0]}"
  # If a .meta.json file was passed by mistake, try the matching .dump file
  if [[ "$dump_file" == *.meta.json ]]; then
    candidate="${dump_file%.meta.json}"
    if [[ -f "$candidate" ]]; then
      echo "Detected metadata file; using dump '$candidate' instead."
      dump_file="$candidate"
    else
      echo "'$dump_file' looks like metadata. Provide the .dump file." >&2
      exit 1
    fi
  fi
  if [[ ! -f "$dump_file" ]]; then
    echo "Dump file '$dump_file' not found" >&2
    exit 1
  fi
else
  # Auto-select latest dump for the current branch
  backup_dir="Database/backups"
  pattern="${BRANCH_SANITIZED}-*.dump"
  # Avoid exit on error when no files match
  set +e
  latest=$(ls -1 "$backup_dir"/$pattern 2>/dev/null | sort | tail -n 1 || true)
  set -e
  selected_branch="$BRANCH_NAME"
  selected_dir="$backup_dir"
  if [[ -z "${latest:-}" ]]; then
    fallback_branch="main"
    fallback_sanitized="$(branch_env_sanitize_branch "$fallback_branch")"
    fallback_dir="$backup_dir"
    fallback_worktree=$(git worktree list --porcelain 2>/dev/null | awk -v target="refs/heads/$fallback_branch" '
      /^worktree / { wt=$2 }
      /^branch / { br=$2 }
      br==target { print wt; exit }
    ')
    if [[ -n "$fallback_worktree" && "$fallback_worktree" != "$REPO_ROOT" ]]; then
      candidate="$fallback_worktree/Database/backups"
      if [[ -d "$candidate" ]]; then
        fallback_dir="$candidate"
      fi
    fi
    set +e
    latest=$(ls -1 "$fallback_dir"/"$fallback_sanitized"-*.dump 2>/dev/null | sort | tail -n 1 || true)
    set -e
    if [[ -z "${latest:-}" ]]; then
      echo "No dump files found for branch '$BRANCH_NAME' in '$backup_dir' or fallback branch '$fallback_branch' in '$fallback_dir'" >&2
      exit 1
    fi
    selected_branch="$fallback_branch"
    selected_dir="$fallback_dir"
  fi
  if [[ "$selected_branch" == "$BRANCH_NAME" ]]; then
    echo "No dump specified; using latest for branch '$BRANCH_NAME': $latest"
  else
    if [[ "$selected_dir" != "$backup_dir" ]]; then
      echo "No dump for branch '$BRANCH_NAME'; using latest for '$selected_branch' from '$selected_dir': $latest"
    else
      echo "No dump for branch '$BRANCH_NAME'; using latest for '$selected_branch': $latest"
    fi
  fi
  dump_file="$latest"
fi

case "$DATABASE_URL" in
  postgresql://*localhost*|postgres://*localhost*)
    ;;
  *)
    echo "Refusing to restore to non-localhost database" >&2
    exit 1
    ;;
esac

# Ensure containers are running for this branch
require_branch_containers

# Optionally reset the 'public' schema to avoid dependency conflicts during restore
if $reset_schema; then
  echo "Resetting schema 'public' (DROP CASCADE; CREATE SCHEMA public)..."
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
  else
    # Run inside db container
    docker compose -p "$COMPOSE_PROJECT" exec -T -e PGPASSWORD=nutrition_pass db \
      psql -h localhost -U nutrition_user -d nutrition -v ON_ERROR_STOP=1 -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
  fi
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
  ran=false
  if command -v alembic >/dev/null 2>&1; then
    echo "Running 'alembic -c Backend/alembic.ini upgrade head' after restore..."
    set +e
    alembic -c Backend/alembic.ini upgrade head
    status=$?
    set -e
    if [[ $status -eq 0 ]]; then
      ran=true
    else
      echo "Host alembic failed (exit $status); attempting inside backend container..." >&2
    fi
  fi
  if [[ "$ran" != true ]]; then
    backend_id=$(docker compose -p "$COMPOSE_PROJECT" ps -q backend 2>/dev/null || true)
    if [[ -n "$backend_id" ]]; then
      echo "Running Alembic inside backend container..."
      docker compose -p "$COMPOSE_PROJECT" exec -T backend alembic -c /app/Backend/alembic.ini upgrade head
    else
      echo "Could not run Alembic on host and backend container not running; skipping upgrade." >&2
    fi
  fi
fi
