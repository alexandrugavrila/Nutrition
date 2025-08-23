#!/usr/bin/env bash
# Ensure the project's virtual environment exists, activate it, and
# install required packages if they are missing

set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_PATH="${VENV_PATH:-$ROOT_DIR/.venv}"
REQUIREMENTS_PATH="${REQUIREMENTS_PATH:-$ROOT_DIR/Backend/requirements.txt}"
FRONTEND_PATH="${FRONTEND_PATH:-$ROOT_DIR/Frontend}"

venv_created=false
if [ ! -d "$VENV_PATH" ]; then
    python -m venv "$VENV_PATH"
    venv_created=true
fi

# Activate the virtual environment unless we're already inside it.
if [ "$VIRTUAL_ENV" != "$VENV_PATH" ]; then
    # shellcheck disable=SC1090
    source "$VENV_PATH/bin/activate"
fi

# Reinstall dependencies if the venv was just created or the requirements
# file has changed since the last install. The hash is cached inside the venv
# directory to avoid unnecessary reinstalls.
HASH_PATH="$VENV_PATH/.requirements.hash"
current_hash="$(sha256sum "$REQUIREMENTS_PATH" | awk '{print $1}')"

if $venv_created || [ ! -f "$HASH_PATH" ] || [ "$current_hash" != "$(cat "$HASH_PATH")" ]; then
    pip install -r "$REQUIREMENTS_PATH"
    echo "$current_hash" > "$HASH_PATH"
fi

PACKAGE_LOCK_PATH="$FRONTEND_PATH/package-lock.json"
NODE_MODULES_PATH="$FRONTEND_PATH/node_modules"
NPM_HASH_PATH="$VENV_PATH/.npm.hash"

if [ -f "$PACKAGE_LOCK_PATH" ]; then
    current_npm_hash="$(sha256sum "$PACKAGE_LOCK_PATH" | awk '{print $1}')"
    if $venv_created || [ ! -d "$NODE_MODULES_PATH" ] || [ ! -f "$NPM_HASH_PATH" ] || [ "$current_npm_hash" != "$(cat "$NPM_HASH_PATH")" ]; then
        (cd "$FRONTEND_PATH" && npm install)
        echo "$current_npm_hash" > "$NPM_HASH_PATH"
    fi
fi
