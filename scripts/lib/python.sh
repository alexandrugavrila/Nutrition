#!/usr/bin/env bash
# Shared helper: select an available Python interpreter.
# Exposes PYTHON_CMD and PYTHON_ARGS in the caller shell.

python_select() {
  # Respect explicit override
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
      return 1
    fi
  fi
  export PYTHON_CMD PYTHON_ARGS
}

