#!/usr/bin/env bash
# Roll back the production application images, with optional database restore.

set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/prod/rollback.sh [<tag>] [--snapshot <snapshot.dump>] [--restore-database] [--reset-schema]

By default this rolls the backend and frontend images back to a specific tag and
refreshes the production stack. If --restore-database is supplied, the script
restores the supplied production snapshot before the stack is brought back up.
If <tag> is omitted, --snapshot metadata must contain backend_image and
frontend_image values to restore exactly.
USAGE
}

TAG=""
SNAPSHOT_PATH=""
RESTORE_DATABASE=false
RESET_SCHEMA=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --snapshot)
      shift
      SNAPSHOT_PATH="${1:-}"
      if [[ -z "$SNAPSHOT_PATH" ]]; then
        usage
        exit 1
      fi
      ;;
    --restore-database)
      RESTORE_DATABASE=true
      ;;
    --reset-schema)
      RESET_SCHEMA=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      usage
      exit 1
      ;;
    *)
      if [[ -n "$TAG" ]]; then
        usage
        exit 1
      fi
      TAG="$1"
      ;;
  esac
  shift
done

if [[ -z "$TAG" && -z "$SNAPSHOT_PATH" ]]; then
  usage
  exit 1
fi

if [[ "$RESTORE_DATABASE" == true && -z "$SNAPSHOT_PATH" ]]; then
  echo "--restore-database requires --snapshot." >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck disable=SC1090
source "$REPO_ROOT/scripts/lib/prod-compose.sh"

cd "$REPO_ROOT"

current_backend_image="$(prod_get_env_value BACKEND_IMAGE)"
current_frontend_image="$(prod_get_env_value FRONTEND_IMAGE)"
resolved_snapshot_path=""
snapshot_backend_image=""
snapshot_frontend_image=""

if [[ -n "$SNAPSHOT_PATH" ]]; then
  resolved_snapshot_path="$(prod_resolve_dump_path "$SNAPSHOT_PATH")"
  meta_path="$(prod_snapshot_metadata_path "$resolved_snapshot_path")"
  if [[ -f "$meta_path" ]]; then
    snapshot_backend_image="$(prod_metadata_value "$meta_path" backend_image)"
    snapshot_frontend_image="$(prod_metadata_value "$meta_path" frontend_image)"
  fi
fi

if [[ -n "$TAG" ]]; then
  target_backend_image="$(prod_set_image_tag "$current_backend_image" "$TAG")"
  target_frontend_image="$(prod_set_image_tag "$current_frontend_image" "$TAG")"
elif [[ -n "$snapshot_backend_image" && -n "$snapshot_frontend_image" ]]; then
  target_backend_image="$snapshot_backend_image"
  target_frontend_image="$snapshot_frontend_image"
else
  echo "Could not determine rollback images from the snapshot metadata. Provide a tag explicitly." >&2
  exit 1
fi

echo "Updating production image references in .env.production..."
echo "  BACKEND_IMAGE: $current_backend_image -> $target_backend_image"
echo "  FRONTEND_IMAGE: $current_frontend_image -> $target_frontend_image"
prod_set_env_value BACKEND_IMAGE "$target_backend_image"
prod_set_env_value FRONTEND_IMAGE "$target_frontend_image"

echo "Pulling rollback target images..."
prod_compose pull db backend frontend edge

if [[ "$RESTORE_DATABASE" == true ]]; then
  echo "Stopping application services before database restore..."
  prod_compose up -d db
  prod_wait_for_service db 180
  prod_compose stop edge frontend backend
  prod_restore "$resolved_snapshot_path" "$RESET_SCHEMA"
fi

echo "Refreshing the production stack..."
prod_compose up -d --force-recreate --remove-orphans

echo "Waiting for production services to report healthy..."
prod_wait_for_stack_ready

echo "Production service status:"
prod_compose ps

echo "Rollback complete."
