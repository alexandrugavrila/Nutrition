#!/usr/bin/env bash
set -euo pipefail

# Synchronize the OpenAPI schema and database migrations with the current models.
#
# The script first regenerates the OpenAPI schema and frontend TypeScript types
# using scripts/db/update-api-schema.sh. If this results in changes, the user is
# prompted whether to keep the updates. In CI or when invoked with -y, the
# updates are kept automatically.
#
# Next, it runs `alembic revision --autogenerate` in check mode to determine if
# model changes require a new migration. If differences are detected, the user is
# asked whether to create a migration. Passing -y (or setting CI=true) will
# automatically create the migration.
#
# This makes the script suitable for interactive use and automation (e.g. GitHub
# Actions). When run in automation, provide `-y` to auto-accept prompts or set the
# CI environment variable to `true`.

AUTO=no
if [[ "${1:-}" == "-y" || "${CI:-}" == "true" ]]; then
  AUTO=yes
fi

# Ensure we're running from the repository root
cd "$(dirname "$0")/../.."

# Load branch-specific environment so we have dev and test ports available
if [ -f "scripts/lib/branch-env.sh" ]; then
  # shellcheck disable=SC1091
  . "scripts/lib/branch-env.sh"
  branch_env_load || true
fi

# Ensure the virtual environment is active and required packages are installed
if [ -z "${VIRTUAL_ENV:-}" ] || ! command -v uvicorn >/dev/null 2>&1; then
  echo "Activating virtual environment..."
  if ! scripts/env/activate-venv.sh >/tmp/venv.log 2>&1; then
    cat /tmp/venv.log
    echo "Failed to activate virtual environment" >&2
    exit 1
  fi
fi

if ! command -v uvicorn >/dev/null 2>&1; then
  echo "uvicorn command not found after activating virtual environment" >&2
  exit 1
fi

# Use a dedicated compose project for the temporary database container.
# Include the branch to avoid collisions across branches.
SYNC_PROJECT="nutrition-sync${BRANCH_SANITIZED:+-$BRANCH_SANITIZED}"

# Clean up any leftover sync database container from previous runs.
if docker compose -p "$SYNC_PROJECT" ps -q db >/dev/null 2>&1; then
  echo "Stopping previous sync database container..."
  docker compose -p "$SYNC_PROJECT" down -v >/tmp/db-old-stop.log 2>&1 || true
fi

# Start a temporary database container if one isn't already running.
# This allows the script to be executed on a host machine without the rest of
# the docker-compose stack. The container is removed when the script exits.
cleanup() {
  if [[ -n "${DB_STARTED:-}" ]]; then
    docker compose -p "$SYNC_PROJECT" down -v >/tmp/db-stop.log 2>&1 || true
  fi
}
trap cleanup EXIT

# Bind the temporary DB to the branch's testing port to avoid colliding with the dev stack.
export DEV_DB_PORT="${TEST_DB_PORT:-${DEV_DB_PORT:-5432}}"
export DATABASE_URL="postgresql://nutrition_user:nutrition_pass@localhost:${DEV_DB_PORT}/nutrition"

echo "Starting database container on test port ${DEV_DB_PORT}..."
if ! docker compose -p "$SYNC_PROJECT" up -d db >/tmp/db-start.log 2>&1; then
  cat /tmp/db-start.log
  echo "Failed to start database container" >&2
  exit 1
fi
DB_STARTED=1

echo "Waiting for database to be ready..."
until docker compose -p "$SYNC_PROJECT" exec -T db pg_isready -U nutrition_user -d nutrition >/tmp/db-ready.log 2>&1; do
  sleep 1
done

echo "Applying database migrations..."
if ! alembic upgrade head >/tmp/db-upgrade.log 2>&1; then
  cat /tmp/db-upgrade.log
  echo "Failed to apply database migrations" >&2
  exit 1
fi

#############################
# Check OpenAPI / Frontend
#############################

# Run the existing update script; capture output to avoid noise
scripts/db/update-api-schema.sh >/tmp/api-sync.log 2>&1 || {
  cat /tmp/api-sync.log
  echo "Failed to update API schema" >&2
  exit 1
}

if ! git diff --quiet -- Backend/openapi.json Frontend/src/api-types.ts; then
  echo "OpenAPI schema or frontend types are out of date."
  if [[ $AUTO == yes ]]; then
    echo "Keeping generated API files."
  else
    read -r -p "Keep generated API files? [y/N] " resp
    if [[ ! $resp =~ ^[Yy]$ ]]; then
      git checkout -- Backend/openapi.json Frontend/src/api-types.ts
      echo "Reverted API changes."
    fi
  fi
else
  echo "OpenAPI schema and frontend types are up to date."
fi

#############################
# Check database migrations
#############################

# Alembic 1.13+ only permits revision generation within configured version
# locations. Create the temporary directory inside the project's versions
# directory and add both locations via --version-path and --version-paths so the
# check remains compatible across Alembic versions.
tmpdir="$(mktemp -d Backend/migrations/versions/tmp.XXXXXX)"
pathsep="$(python - <<'PY'
import os
print(os.pathsep)
PY
)"
version_paths="Backend/migrations/versions${pathsep}${tmpdir}"
if ! alembic revision --autogenerate -m "tmp" --version-path "$tmpdir" --version-paths "$version_paths" >/dev/null 2>&1; then
  if ! alembic revision --autogenerate -m "tmp" --version-path "$tmpdir" >/dev/null 2>&1; then
    rm -r "$tmpdir"
    echo "Failed to check for migration changes" >&2
    exit 1
  fi
fi
tmpfile="$(find "$tmpdir" -type f | head -n 1)"
if [[ -f "$tmpfile" && $(grep -E "op\\." "$tmpfile") ]]; then
  echo "Model changes detected that are not captured in migrations."
  if [[ $AUTO == yes ]]; then
    msg="auto migration"
    alembic revision --autogenerate -m "$msg"
    echo "Created migration: $msg"
  else
    read -r -p "Generate new migration now? [y/N] " resp
    if [[ $resp =~ ^[Yy]$ ]]; then
      read -r -p "Migration message: " msg
      alembic revision --autogenerate -m "$msg"
    else
      echo "Skipping migration generation."
    fi
  fi
else
  echo "Database migrations are up to date."
fi
rm -r "$tmpdir"
