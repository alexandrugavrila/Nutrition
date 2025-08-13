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

# Determine repo root
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

# Determine branch-specific project name
branch="$(git rev-parse --abbrev-ref HEAD)"
san=$(echo "$branch" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/^[-]*//;s/[-]*$//')
project="nutrition-$san"

# Ensure containers are running for this branch
if [[ -z $(docker compose -p "$project" ps -q 2>/dev/null) ]]; then
  echo "Warning: no containers running for branch '$branch'. Run the compose script first." >&2
  exit 1
fi

# Get mapped database port
port_line=$(docker compose -p "$project" port db 5432 2>/dev/null || true)
if [[ -z "$port_line" ]]; then
  echo "Warning: unable to determine database port for project '$project'." >&2
  exit 1
fi
DB_PORT=${port_line##*:}

export DB_PORT
python Database/import_from_csv.py "$flag"
