#!/usr/bin/env sh
set -eu
# Enable pipefail if supported (e.g., bash, zsh)
if [ -n "${BASH_VERSION-}" ] || [ -n "${ZSH_VERSION-}" ]; then
  set -o pipefail
fi

UVICORN_PID=""
cleanup() {
  if [ -n "${UVICORN_PID:-}" ]; then
    kill "$UVICORN_PID" 2>/dev/null || true
    wait "$UVICORN_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT

DEV_BACKEND_PORT="${DEV_BACKEND_PORT:-8000}"

# Determine a workable Python command. Default to `python` but fall back to
# `python3` or `py -3` for environments (such as Windows/WSL) where the default
# isn't available on the PATH.
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

# Launch the FastAPI app in the background using the Python module invocation
# to avoid relying on the `uvicorn` entry point being on the PATH.
"$PYTHON_CMD" $PYTHON_ARGS -m uvicorn Backend.backend:app --port "$DEV_BACKEND_PORT" &
UVICORN_PID=$!
# Wait for the server to be ready
until curl --silent --fail "http://localhost:${DEV_BACKEND_PORT}/openapi.json" >/dev/null; do
  sleep 1
done

# Capture the schema
curl "http://localhost:${DEV_BACKEND_PORT}/openapi.json" -o Backend/openapi.json

# Generate TypeScript types for the frontend
npx --prefix Frontend openapi-typescript Backend/openapi.json -o Frontend/src/api-types.ts
