#!/usr/bin/env bash
# Deploy a specific production application tag through the production compose stack.

set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/prod/deploy.sh <tag>

Updates BACKEND_IMAGE and FRONTEND_IMAGE in .env.production to the requested
tag, takes a pre-deploy database snapshot, pulls the production images, runs
Alembic migrations through a one-off backend container, refreshes the
production stack, and verifies basic health.
USAGE
}

if [[ $# -ne 1 ]]; then
  usage
  exit 1
fi

TAG=$1
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck disable=SC1090
source "$REPO_ROOT/scripts/lib/prod-compose.sh"

cd "$REPO_ROOT"

snapshot_path="$(prod_backup "predeploy-$TAG")"
echo "Pre-deploy snapshot: $snapshot_path"
echo "Snapshot metadata:   ${snapshot_path}.meta.json"

current_backend_image="$(prod_get_env_value BACKEND_IMAGE)"
current_frontend_image="$(prod_get_env_value FRONTEND_IMAGE)"
new_backend_image="$(prod_set_image_tag "$current_backend_image" "$TAG")"
new_frontend_image="$(prod_set_image_tag "$current_frontend_image" "$TAG")"

echo "Updating production image references in .env.production..."
echo "  BACKEND_IMAGE: $current_backend_image -> $new_backend_image"
echo "  FRONTEND_IMAGE: $current_frontend_image -> $new_frontend_image"
prod_set_env_value BACKEND_IMAGE "$new_backend_image"
prod_set_env_value FRONTEND_IMAGE "$new_frontend_image"

echo "Pulling production images..."
prod_compose pull db backend frontend edge

echo "Ensuring the production database service is running..."
prod_compose up -d db
prod_wait_for_service db 180

prod_run_migration

echo "Refreshing the production stack..."
prod_compose up -d --force-recreate --remove-orphans

echo "Waiting for production services to report healthy..."
prod_wait_for_stack_ready

echo "Production service status:"
prod_compose ps

echo "Deployment complete."
