#!/usr/bin/env bash
set -euo pipefail

# Synchronize the OpenAPI schema and database migrations with the current models.
#
# The script first regenerates the OpenAPI schema and frontend TypeScript types
# using scripts/update-api-schema.sh. If this results in changes, the user is
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
cd "$(dirname "$0")/.."

#############################
# Check OpenAPI / Frontend
#############################

# Run the existing update script; capture output to avoid noise
scripts/update-api-schema.sh >/tmp/api-sync.log 2>&1 || {
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

tmpfile="$(mktemp)"
alembic revision --autogenerate -m "tmp" --stdout > "$tmpfile"
if grep -q -E "op\." "$tmpfile"; then
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
rm "$tmpfile"

