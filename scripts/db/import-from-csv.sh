#!/usr/bin/env bash
# Wrapper to run import_from_csv.py against the containers for the current branch.
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: import-from-csv.sh -production|-test [--allow-production-seed] [--allow-non-local-db]

Options:
  --allow-production-seed  Required when using -production to avoid accidental reseeding.
  --allow-non-local-db     Required when DATABASE_URL does not target localhost.
USAGE
  exit 1
}

mode=""
allow_prod_seed=false
allow_non_local=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    -production|--production) mode="production" ;;
    -test|--test) mode="test" ;;
    --allow-production-seed) allow_prod_seed=true ;;
    --allow-non-local-db) allow_non_local=true ;;
    -h|--help) usage ;;
    *) usage ;;
  esac
  shift
done

if [[ -z "$mode" ]]; then
  usage
fi

if [[ "$mode" == "production" && "$allow_prod_seed" != true ]]; then
  echo "Refusing production CSV seed without --allow-production-seed." >&2
  exit 1
fi

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

if [[ "$DATABASE_URL" != *"localhost"* && "$allow_non_local" != true ]]; then
  echo "Refusing to target non-local database without --allow-non-local-db." >&2
  exit 1
fi

export DEV_DB_PORT
if [[ "$mode" == "production" ]]; then
  python Database/import_from_csv.py --production
else
  python Database/import_from_csv.py --test
fi
