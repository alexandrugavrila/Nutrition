#!/usr/bin/env bash
# Wrapper to run import_from_csv.py against the containers for the current branch.
set -euo pipefail

usage() {
  echo "Usage: $(basename "$0") -production|-test" >&2
  exit 1
}

if [[ $# -ne 1 ]]; then
  usage
fi

case "$1" in
  -production|--production)
    flag="--production"
    ;;
  -test|--test)
    flag="--test"
    ;;
  *)
    usage
    ;;
esac

source "$(dirname "${BASH_SOURCE[0]}")/lib/branch-env.sh"
branch_env_load
cd "$REPO_ROOT"

# Ensure containers are running for this branch
if [[ -z $(docker compose -p "$COMPOSE_PROJECT" ps -q 2>/dev/null) ]]; then
  echo "Warning: no containers running for branch '$BRANCH_NAME'. Run the compose script first." >&2
  exit 1
fi

export DB_PORT
python Database/import_from_csv.py "$flag"
