#!/usr/bin/env bash
# Build and publish immutable backend/frontend images for a release tag.

set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: ./scripts/prod/publish.sh [<tag>] [--create-git-tag] [--push-git-tag]

Reads registry credentials and image repositories from environment variables,
.env.publish, or .env, shows the latest 3 local git tags as release hints,
optionally prompts for a new tag, then builds and pushes the backend and
frontend images using the same Dockerfiles used by CI.
USAGE
}

TAG=""
CREATE_GIT_TAG=false
PUSH_GIT_TAG=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --create-git-tag)
      CREATE_GIT_TAG=true
      ;;
    --push-git-tag)
      PUSH_GIT_TAG=true
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

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck disable=SC1090
source "$REPO_ROOT/scripts/lib/publish-utils.sh"

cd "$REPO_ROOT"

resolved_tag="$(publish_resolve_tag "$TAG")"
backend_repo="$(publish_get_env_value BACKEND_IMAGE_REPO)"
frontend_repo="$(publish_get_env_value FRONTEND_IMAGE_REPO)"
backend_image="${backend_repo}:${resolved_tag}"
frontend_image="${frontend_repo}:${resolved_tag}"
registry="$(publish_registry_host "$backend_repo")"

echo "Publishing release tag '$resolved_tag'"
echo "  Backend:  $backend_image"
echo "  Frontend: $frontend_image"

publish_registry_login "$registry"
publish_build_images "$backend_image" "$frontend_image"
publish_push_images "$backend_image" "$frontend_image"

if [[ "$CREATE_GIT_TAG" == true || "$PUSH_GIT_TAG" == true ]]; then
  publish_ensure_git_tag "$resolved_tag" "$PUSH_GIT_TAG"
fi

echo "Publish complete."
echo "Next deploy command:"
echo "  ./scripts/prod/deploy.sh $resolved_tag"
