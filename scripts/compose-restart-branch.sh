#!/usr/bin/env bash
# scripts/compose-restart-branch.sh
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

branch="$(git rev-parse --abbrev-ref HEAD | tr -d '\n')"
san="$(echo "$branch" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/^[-]*//;s/[-]*$//')"
project="nutrition-$san"

echo "Bringing down containers for '$branch'..."
docker compose -p "$project" down -v --remove-orphans >/dev/null 2>&1 || true
docker network rm "${project}_default" >/dev/null 2>&1 || true
docker volume rm "${project}_node_modules" >/dev/null 2>&1 || true

echo "Bringing up containers..."
"$repo_root/scripts/compose-up-branch.sh" "$@"
