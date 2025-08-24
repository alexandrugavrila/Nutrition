#!/usr/bin/env bash
# Verify that database models and migrations are in sync.
# Generates a temporary migration and fails if operations are detected.

set -euo pipefail

# Ensure we're running from the repository root
cd "$(dirname "$0")/.."

# Ensure the virtual environment is active so alembic is available
if [ -z "${VIRTUAL_ENV:-}" ] || ! command -v alembic >/dev/null 2>&1; then
  echo "Activating virtual environment..."
  set +u
  # shellcheck source=scripts/activate-venv.sh disable=SC1091
  source scripts/activate-venv.sh >/tmp/venv.log 2>&1 || {
    cat /tmp/venv.log
    echo "Failed to activate virtual environment" >&2
    exit 1
  }
  set -u
fi

if ! command -v alembic >/dev/null 2>&1; then
  echo "alembic command not found" >&2
  exit 1
fi

# Determine a free TCP port
get_free_port() {
  python - <<'PY'
import socket
s=socket.socket()
s.bind(("",0))
print(s.getsockname()[1])
s.close()
PY
}

DB_PORT="${DB_PORT:-$(get_free_port)}"
CONTAINER_NAME="nutrition-drift-$(tr -d '-' < /proc/sys/kernel/random/uuid)"

# Ensure DATABASE_URL uses the selected port
if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://nutrition_user:nutrition_pass@localhost:${DB_PORT}/nutrition"
else
  DATABASE_URL="$(python - <<'PY'
import os, urllib.parse
url=os.environ['DATABASE_URL']
port=int(os.environ['DB_PORT'])
parsed=urllib.parse.urlparse(url)
netloc=f"{parsed.hostname}:{port}"
if parsed.username:
    if parsed.password:
        netloc=f"{parsed.username}:{parsed.password}@"+netloc
    else:
        netloc=f"{parsed.username}@"+netloc
new_url=urllib.parse.urlunparse((parsed.scheme, netloc, parsed.path or '/nutrition', '', '', ''))
print(new_url)
PY
)"
  export DATABASE_URL
fi

cleanup() {
  if [[ -n "${DB_STARTED:-}" ]]; then
    echo "Removing temporary database container ${CONTAINER_NAME}..."
    docker rm -f "${CONTAINER_NAME}" >/tmp/db-rm.log 2>&1 || true
  fi
}
trap cleanup EXIT

# Start database container
echo "Starting temporary database container ${CONTAINER_NAME} on port ${DB_PORT}..."
if ! docker run -d --name "${CONTAINER_NAME}" -e POSTGRES_USER=nutrition_user -e POSTGRES_PASSWORD=nutrition_pass -e POSTGRES_DB=nutrition -p "${DB_PORT}:5432" postgres:16 >/tmp/db-start.log 2>&1; then
  cat /tmp/db-start.log
  echo "failed to start database container" >&2
  exit 1
fi
DB_STARTED=1

# Wait for database readiness (2 minute timeout)
end=$((SECONDS+120))
until docker exec "${CONTAINER_NAME}" pg_isready -U nutrition_user -d nutrition >/tmp/db-ready.log 2>&1; do
  if [ $SECONDS -ge $end ]; then
    cat /tmp/db-ready.log
    echo "Postgres did not become ready in 2 minutes" >&2
    exit 1
  fi
  sleep 1
done

# Apply existing migrations
if ! alembic upgrade head >/tmp/db-upgrade.log 2>&1; then
  cat /tmp/db-upgrade.log
  echo "alembic upgrade head failed" >&2
  exit 1
fi

# Prepare temporary directory under the migrations versions folder
migration_root="Backend/migrations/versions"
if [ ! -d "$migration_root" ]; then
  echo "Alembic versions directory not found: $migration_root" >&2
  exit 1
fi

tmpdir="$(mktemp -d "$migration_root/tmp.XXXXXX")"
pathsep="$(python - <<'PY'
import os
print(os.pathsep)
PY
)"
version_paths="${migration_root}${pathsep}${tmpdir}"

# Generate a temporary revision
if ! alembic --version-paths "$version_paths" revision --autogenerate -m "drift check" --version-path "$tmpdir" >/tmp/rev.log 2>&1; then
  cat /tmp/rev.log
  rm -r "$tmpdir"
  echo "Failed to generate drift check migration" >&2
  exit 1
fi

revision="$(find "$tmpdir" -name '*.py' | head -n 1)"
if [ -z "$revision" ]; then
  rm -r "$tmpdir"
  echo "No revision file generated" >&2
  exit 1
fi

if grep -Eq '\bop\.' "$revision"; then
  echo "Migration drift detected. See $revision" >&2
  rm -r "$tmpdir"
  exit 1
fi

rm -r "$tmpdir"
echo "No migration drift detected."

