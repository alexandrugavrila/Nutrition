#!/usr/bin/env bash
# scripts/check-migration-drift.sh
# Ensure Alembic migrations reflect models and produce an up-to-date DB.
# Exit codes:
#   0 = Up to date (already clean, or adopted migration and verified clean)
#   1 = Script error (infra/tooling failure)
#   2 = Unexpected continued drift after adoption (investigate)

set -euo pipefail

# -------- utils ----------
log()   { printf '%s\n' "$*"; }
warn()  { printf '\033[33m%s\033[0m\n' "$*" >&2; }
okay()  { printf '\033[32m%s\033[0m\n' "$*"; }
error() { printf '\033[31m%s\033[0m\n' "$*" >&2; }

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

alembic_ini="$repo_root/Backend/alembic.ini"
migration_root="$repo_root/Backend/migrations/versions"
[[ -d "$migration_root" ]] || { error "Alembic versions directory not found: $migration_root"; exit 1; }
has_alembic_ini=0; [[ -f "$alembic_ini" ]] && has_alembic_ini=1

get_free_tcp_port() {
  python - <<'PY'
import socket
s=socket.socket(); s.bind(('',0)); print(s.getsockname()[1]); s.close()
PY
}

short_rev_id() {
  # 12-char hex from uuid4
  python - <<'PY'
import uuid; print(uuid.uuid4().hex[:12])
PY
}

timestamp_slug() {
  date +"%Y%m%d_%H%M%S"
}

invoke_alembic() {
  local args=("$@")
  if [[ $has_alembic_ini -eq 1 ]]; then
    alembic -c "$alembic_ini" "${args[@]}"
  else
    alembic "${args[@]}"
  fi
}

# Ensure alembic is available; try to activate a venv if needed
ensure_alembic() {
  if ! command -v alembic >/dev/null 2>&1; then
    # Try common activation paths
    if [[ -f "$script_dir/activate-venv.sh" ]]; then
      # Your project-specific activator (if you have it)
      # shellcheck disable=SC1091
      source "$script_dir/activate-venv.sh"
    elif [[ -d "$repo_root/.venv" && -f "$repo_root/.venv/bin/activate" ]]; then
      # shellcheck disable=SC1091
      source "$repo_root/.venv/bin/activate"
    fi
  fi
  if ! command -v alembic >/dev/null 2>&1; then
    error "alembic command not found (consider creating/activating a venv first)"
    exit 1
  fi
}

# ---- DB container setup ----
db_port="${DB_PORT:-}"
if [[ -z "${db_port}" ]]; then
  db_port="$(get_free_tcp_port)"
  export DB_PORT="$db_port"
fi

container_name="nutrition-drift-$(python - <<'PY'
import uuid; print(uuid.uuid4().hex)
PY
)"

# Normalize DATABASE_URL to use the chosen port (best-effort)
if [[ -z "${DATABASE_URL:-}" ]]; then
  export DATABASE_URL="postgresql://nutrition_user:nutrition_pass@localhost:${DB_PORT}/nutrition"
else
  # Replace :<digits>/ with :$DB_PORT/ (only first match)
  new_url="$(printf '%s' "$DATABASE_URL" | perl -pe 's{:(\d+)(?=/)}{:'"$DB_PORT"'} if ! $done++')"
  export DATABASE_URL="$new_url"
fi

# Extract DB credentials from DATABASE_URL for container setup
db_user="$(printf '%s' "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*@.*|\1|p')"
db_pass="$(printf '%s' "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')"
db_user="${db_user:-nutrition_user}"
db_pass="${db_pass:-nutrition_pass}"

# --- PRE-RUN CLEANUP: remove any stale drift-check temp files -----------------
drift_glob="*_driftchecktmp*.py"
find "$migration_root" -maxdepth 1 -type f -name "$drift_glob" -print0 2>/dev/null | xargs -0r rm -f || true

fatal_error=""
db_started=0
first_generated_path=""
adopted_path=""
verify_generated_path=""
adoption_performed=0
verify_had_ops=0
first_had_ops=0

start_temp_db() {
  log "Starting temporary database container $container_name on port $DB_PORT..."
  docker pull postgres:16 >/dev/null
  docker run -d --name "$container_name" \
    -e POSTGRES_USER="$db_user" \
    -e POSTGRES_PASSWORD="$db_pass" \
    -e POSTGRES_DB=nutrition \
    -p "${DB_PORT}:5432" \
    postgres:16 >/dev/null
  db_started=1

  log "Waiting for database to be ready (timeout 2 minutes)..."
  end=$((SECONDS+120))
  until docker exec "$container_name" pg_isready -U "$db_user" -d nutrition >/dev/null 2>&1; do
    if (( SECONDS > end )); then
      error "Postgres did not become ready in 2 minutes"
      return 1
    fi
    sleep 1
  done
}

new_temp_revision() {
  local message="$1"
  local rev_id
  rev_id="$(short_rev_id)"
  invoke_alembic revision --autogenerate --rev-id "$rev_id" -m "$message"
  # Locate generated file
  local file
  file="$(find "$migration_root" -maxdepth 1 -type f -name "${rev_id}*.py" | head -n1 || true)"
  [[ -n "$file" ]] || { error "No revision file generated for rev-id $rev_id"; return 1; }
  printf '%s\n' "$file"
}

test_revision_has_ops() {
  local path="$1"
  local has_rev=0
  if grep -Eq '^[[:space:]]*revision[[:space:]]*=[[:space:]]*["'\''][0-9A-Za-z_-]+["'\'']' "$path"; then
    has_rev=1
  fi
  if [[ $has_rev -eq 0 ]]; then
    error "Generated file malformed (no 'revision ='): $path"
    return 2
  fi
  if grep -Eq '^[[:space:]]*op\.[A-Za-z0-9_]+\(' "$path"; then
    return 0  # has ops
  else
    return 1  # no ops
  fi
}

convert_drift_file_to_migration() {
  local path="$1"
  local slug="sync_models_$(timestamp_slug)"
  local dir base rev new_name new_path
  dir="$(dirname "$path")"
  base="$(basename "$path")"

  if [[ "$base" =~ ^([0-9a-fA-F]+)_ ]]; then
    rev="${BASH_REMATCH[1]}"
  else
    error "Could not parse revision id from filename: $base"
    return 1
  fi

  new_name="${rev}_${slug}.py"
  new_path="${dir}/${new_name}"

  # Replace ONLY the first line that starts with triple quotes
  # Portable awk approach: replace the first line matching ^""" with """<slug>
  awk -v slug="$slug" '
    BEGIN{done=0}
    {
      if (!done && $0 ~ /^"""/) { print "\"\"\"" slug; done=1; next }
      print
    }
  ' "$path" > "${path}.tmp" && mv "${path}.tmp" "$path"

  mv "$path" "$new_path"
  printf '%s\n' "$new_path"
}

clear_temp_drift_files() {
  find "$migration_root" -maxdepth 1 -type f -name "$drift_glob" -print0 2>/dev/null | xargs -0r rm -f || true
}

cleanup() {
  # Container
  if [[ $db_started -eq 1 ]]; then
    log "Removing temporary database container $container_name..."
    docker rm -f "$container_name" >/dev/null 2>&1 || true
  fi
  # Temp revisions
  if [[ -n "$first_generated_path" && $adoption_performed -eq 0 ]]; then
    rm -f "$first_generated_path" 2>/dev/null || true
    first_generated_path=""
  fi
  if [[ -n "$verify_generated_path" ]]; then
    rm -f "$verify_generated_path" 2>/dev/null || true
    verify_generated_path=""
  fi
  clear_temp_drift_files
}

trap 'cleanup' EXIT

# ---------------------- main flow ----------------------
ensure_alembic

if ! start_temp_db; then
  fatal_error="failed to start database container or wait for readiness"
fi

if [[ -z "$fatal_error" ]]; then
  # Apply existing migrations
  if ! invoke_alembic upgrade head; then
    fatal_error="alembic upgrade head failed"
  fi
fi

if [[ -z "$fatal_error" ]]; then
  # First autogenerate: detect drift
  if ! first_generated_path="$(new_temp_revision "driftchecktmp")"; then
    fatal_error="failed to generate first temp revision"
  else
    if test_revision_has_ops "$first_generated_path"; then
      first_had_ops=1
    else
      first_had_ops=0
    fi
  fi
fi

if [[ -z "$fatal_error" && $first_had_ops -eq 1 ]]; then
  warn "Drift detected, adopting migration..."
  if adopted_path="$(convert_drift_file_to_migration "$first_generated_path")"; then
    adoption_performed=1
    # Apply adopted migration
    if ! invoke_alembic upgrade head; then
      fatal_error="alembic upgrade head failed (after adoption)"
    else
      # Verify clean with a second autogenerate
      if verify_generated_path="$(new_temp_revision "driftchecktmp_verify")"; then
        if test_revision_has_ops "$verify_generated_path"; then
          verify_had_ops=1
        else
          verify_had_ops=0
          rm -f "$verify_generated_path" 2>/dev/null || true
          verify_generated_path=""
        fi
      else
        fatal_error="failed to generate verification temp revision"
      fi
    fi
  else
    fatal_error="failed to convert drift file to real migration"
  fi
elif [[ -z "$fatal_error" && $first_had_ops -eq 0 ]]; then
  # No drift: remove the empty temp revision
  rm -f "$first_generated_path" 2>/dev/null || true
  first_generated_path=""
fi

# ---------------------- summary & exit -----------------
if [[ -n "$fatal_error" ]]; then
  error "Script failed: $fatal_error"
  error "[RESULT] Script error"
  exit 1
fi

if [[ $adoption_performed -eq 1 ]]; then
  if [[ $verify_had_ops -eq 1 ]]; then
    warn "Adopted $adopted_path, but a verification autogenerate still found differences."
    warn "Investigate your models/env.py autogenerate settings. A noisy config can cause perpetual diffs."
    warn "[RESULT] Continued drift after adoption"
    exit 2
  else
    okay "Adopted migration: $adopted_path"
    okay "Verification clean: migrations now reproduce the model schema."
    okay "[RESULT] Up to date (after adoption)"
    exit 0
  fi
else
  okay "No migration drift detected."
  okay "[RESULT] Up to date (no drift)"
  exit 0
fi
