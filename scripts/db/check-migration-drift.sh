#!/usr/bin/env sh
set -eu
if [ -n "${BASH_VERSION-}" ] || [ -n "${ZSH_VERSION-}" ]; then
  set -o pipefail
fi

# Resolve Python interpreter via shared helper
# shellcheck disable=SC1090
. "$(dirname "$0")/../lib/python.sh"
python_select

# Load branch-specific environment to populate TEST_* ports, if available
if [ -f "$(dirname "$0")/../lib/branch-env.sh" ]; then
  # shellcheck disable=SC1090
  . "$(dirname "$0")/../lib/branch-env.sh"
  branch_env_load || true
fi

script_dir="$(dirname "$0")"
exec "$PYTHON_CMD" $PYTHON_ARGS "$script_dir/check_migration_drift.py" "$@"
