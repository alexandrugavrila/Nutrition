#!/usr/bin/env bash
set -euo pipefail

PYTHONPATH=Backend uvicorn backend:app --port 8000 &
UVICORN_PID=$!
trap "kill $UVICORN_PID 2>/dev/null || true; wait $UVICORN_PID 2>/dev/null || true" EXIT

until curl --silent --fail http://localhost:8000/openapi.json >/dev/null; do
  sleep 1
done

curl http://localhost:8000/openapi.json -o Backend/openapi.json

npx --prefix Frontend/nutrition-frontend openapi-typescript Backend/openapi.json -o Frontend/nutrition-frontend/src/api-types.ts
