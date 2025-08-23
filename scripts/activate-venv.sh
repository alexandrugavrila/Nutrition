#!/usr/bin/env bash
# Ensure the project's virtual environment exists, activate it, and
# install required packages if they are missing

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_PATH="${VENV_PATH:-$ROOT_DIR/.venv}"
REQUIREMENTS_PATH="${REQUIREMENTS_PATH:-$ROOT_DIR/Backend/requirements.txt}"

venv_created=false
if [ ! -d "$VENV_PATH" ]; then
    python -m venv "$VENV_PATH"
    venv_created=true
fi

# shellcheck disable=SC1090
source "$VENV_PATH/bin/activate"

# Reinstall dependencies if the venv was just created or the requirements
# file has changed since the last install. The hash is cached inside the venv
# directory to avoid unnecessary reinstalls.
HASH_PATH="$VENV_PATH/.requirements.hash"
current_hash="$(sha256sum "$REQUIREMENTS_PATH" | awk '{print $1}')"

if $venv_created || [ ! -f "$HASH_PATH" ] || [ "$current_hash" != "$(cat "$HASH_PATH")" ]; then
    pip install -r "$REQUIREMENTS_PATH"
    echo "$current_hash" > "$HASH_PATH"
fi
