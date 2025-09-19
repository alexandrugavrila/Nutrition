#!/usr/bin/env bash
# Export branch-local PostgreSQL tables to CSV files.
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: export-to-csv.sh [--production|--test] [--output-dir PATH]

Options:
  --production        Write CSVs into Database/production_data (default)
  --test              Write CSVs into Database/test_data
  --output-dir PATH   Override the destination directory
  -h, --help          Show this help message
USAGE
  exit 1
}

mode=""
output_dir=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --production)
      if [[ "$mode" == "test" ]]; then
        echo "Cannot combine --production and --test" >&2
        usage
      fi
      mode="production"
      shift
      ;;
    --test)
      if [[ "$mode" == "production" ]]; then
        echo "Cannot combine --production and --test" >&2
        usage
      fi
      mode="test"
      shift
      ;;
    --output-dir)
      if [[ $# -lt 2 ]]; then
        usage
      fi
      output_dir="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    --)
      shift
      break
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      ;;
  esac
done

if [[ $# -gt 0 ]]; then
  echo "Unexpected argument(s): $*" >&2
  usage
fi

if [[ -z "$mode" ]]; then
  mode="production"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../lib/branch-env.sh"
branch_env_load
source "$SCRIPT_DIR/../lib/venv.sh"
source "$SCRIPT_DIR/../lib/compose-utils.sh"
cd "$REPO_ROOT"

ensure_venv
require_branch_containers

python_args=()
if [[ "$mode" == "test" ]]; then
  python_args+=("--test")
else
  python_args+=("--production")
fi

if [[ -n "$output_dir" ]]; then
  resolved=$(python - "$output_dir" <<'PY'
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
  )
  python_args+=("--output-dir" "$resolved")
fi

python Database/export_to_csv.py "${python_args[@]}"
