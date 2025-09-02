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

# Ensure virtual environment is active for uvicorn and dependencies
# shellcheck disable=SC1090
. "$(dirname "$0")/../lib/venv.sh"
ensure_venv

# Determine a workable Python command via shared helper
# shellcheck disable=SC1090
. "$(dirname "$0")/../lib/python.sh"
python_select

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
