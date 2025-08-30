#!/usr/bin/env sh
set -eu
if [ -n "${BASH_VERSION-}" ] || [ -n "${ZSH_VERSION-}" ]; then
  set -o pipefail
fi

PYTHON_CMD="${PYTHON:-python}"
PYTHON_ARGS=""
if ! command -v "$PYTHON_CMD" >/dev/null 2>&1; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD=python3
  elif command -v py >/dev/null 2>&1; then
    PYTHON_CMD=py
    PYTHON_ARGS="-3"
  else
    echo "Python is required but was not found on PATH" >&2
    exit 1
  fi
fi

# Load branch-specific environment to populate TEST_* ports, if available
if [ -f "$(dirname "$0")/../lib/branch-env.sh" ]; then
  # shellcheck disable=SC1090
  . "$(dirname "$0")/../lib/branch-env.sh"
  branch_env_load || true
fi

script_dir="$(dirname "$0")"
exec "$PYTHON_CMD" $PYTHON_ARGS "$script_dir/check_migration_drift.py" "$@"
