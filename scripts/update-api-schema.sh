#!/usr/bin/env bash
set -euo pipefail

UVICORN_PID=""
cleanup() {
  if [[ -n "${UVICORN_PID:-}" ]]; then
    kill "$UVICORN_PID" 2>/dev/null || true
    wait "$UVICORN_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT

BACKEND_PORT="${BACKEND_PORT:-8000}"

# Launch the FastAPI app in the background
uvicorn Backend.backend:app --port "$BACKEND_PORT" &
UVICORN_PID=$!
# Wait for the server to be ready
until curl --silent --fail "http://localhost:${BACKEND_PORT}/openapi.json" >/dev/null; do
  sleep 1
done

# Capture the schema
curl "http://localhost:${BACKEND_PORT}/openapi.json" -o Backend/openapi.json

# Generate TypeScript types for the frontend
npx --prefix Frontend/nutrition-frontend openapi-typescript Backend/openapi.json -o Frontend/nutrition-frontend/src/api-types.ts
