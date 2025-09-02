#!/usr/bin/env bash
# Shared helper: ensure project virtual environment is created and activated.

ensure_venv() {
  local root
  root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  # Activate in current shell; activation script will create venv and install deps as needed
  # shellcheck disable=SC1090
  if ! source "$root/env/activate-venv.sh" >/tmp/venv.log 2>&1; then
    cat /tmp/venv.log || true
    echo "Failed to activate virtual environment" >&2
    return 1
  fi
}

