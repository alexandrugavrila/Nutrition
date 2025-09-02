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
# Shared helpers
source "$(dirname "${BASH_SOURCE[0]}")/../lib/venv.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../lib/compose-utils.sh"
cd "$REPO_ROOT"

# Ensure the virtual environment is active
ensure_venv

# Ensure containers are running for this branch
require_branch_containers

export DEV_DB_PORT
python Database/import_from_csv.py "$flag"
