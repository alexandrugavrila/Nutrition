#!/usr/bin/env bash
set -euo pipefail

BRANCH=$(git rev-parse --abbrev-ref HEAD)
SANITIZED=$(echo "$BRANCH" | tr '[:upper:]' '[:lower:]' | sed 's#[^a-z0-9]#-#g')

echo "Starting containers for branch: $BRANCH (sanitized: $SANITIZED)"

docker compose -p "nutrition-$SANITIZED" up -d "$@"
