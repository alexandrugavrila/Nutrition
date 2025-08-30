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

source "$(dirname "${BASH_SOURCE[0]}")/../lib/branch-env.sh"
branch_env_load
cd "$REPO_ROOT"

# Ensure the virtual environment is active
if [[ -z "${VIRTUAL_ENV:-}" ]]; then
  echo "No virtualenv detected; activating via ./scripts/env/activate-venv.sh ..."
  if ! source ./scripts/env/activate-venv.sh >/tmp/venv.log 2>&1; then
    cat /tmp/venv.log
    echo "Failed to activate virtual environment" >&2
    exit 1
  fi
fi

# Ensure containers are running for this branch
if [[ -z $(docker compose -p "$COMPOSE_PROJECT" ps -q 2>/dev/null) ]]; then
  echo "Warning: no containers running for branch '$BRANCH_NAME'. Run the compose script first." >&2
  exit 1
fi

export DEV_DB_PORT
python Database/import_from_csv.py "$flag"
