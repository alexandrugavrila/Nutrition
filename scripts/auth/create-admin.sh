#!/usr/bin/env bash
# Creates an admin account against the running branch-local database.
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: create-admin.sh --email <email> --password <password> --display-name <name>
USAGE
}

email=""
password=""
display_name=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email) email="${2:-}"; shift 2 ;;
    --password) password="${2:-}"; shift 2 ;;
    --display-name) display_name="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac
done

if [[ -z "$email" || -z "$password" || -z "$display_name" ]]; then
  usage
  exit 1
fi

source "$(dirname "${BASH_SOURCE[0]}")/../lib/branch-env.sh"
branch_env_load
source "$(dirname "${BASH_SOURCE[0]}")/../lib/compose-utils.sh"
cd "$REPO_ROOT"

require_branch_containers
source "$(dirname "${BASH_SOURCE[0]}")/../env/activate-venv.sh"

export DATABASE_URL="postgresql://nutrition_user:nutrition_pass@localhost:${DEV_DB_PORT}/nutrition"

"$REPO_ROOT/.venv/bin/python" "$REPO_ROOT/scripts/auth/create-admin.py" \
  --email "$email" \
  --password "$password" \
  --display-name "$display_name"
