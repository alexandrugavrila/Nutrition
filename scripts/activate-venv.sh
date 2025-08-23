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

if $venv_created || ! pip show sqlmodel >/dev/null 2>&1; then
    pip install -r "$REQUIREMENTS_PATH"
fi
