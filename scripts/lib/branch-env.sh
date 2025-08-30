#!/usr/bin/env bash
# scripts/lib/branch-env.sh
# Shared helpers for branch-specific environment variables.

# Return the absolute path to the repository root.
branch_env_repo_root() {
  git rev-parse --show-toplevel
}

# Sanitize a Git branch name to be Docker/filename friendly.
# Usage: branch_env_sanitize_branch "feature/My Branch" -> "feature-my-branch"
branch_env_sanitize_branch() {
  local branch="${1:?branch name required}"
  echo "$branch" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/^[-]*//;s/[-]*$//'
}

# Compute branch-specific environment variables and export them.
# Sets: REPO_ROOT, BRANCH_NAME, BRANCH_SANITIZED, COMPOSE_PROJECT,
#       PORT_OFFSET, DB_PORT, BACKEND_PORT, FRONTEND_PORT, DATABASE_URL
branch_env_load() {
  REPO_ROOT="$(branch_env_repo_root)"
  BRANCH_NAME="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD | tr -d '\n')"
  BRANCH_SANITIZED="$(branch_env_sanitize_branch "$BRANCH_NAME")"
  COMPOSE_PROJECT="nutrition-$BRANCH_SANITIZED"
  local offset_hex
  offset_hex="$(printf '%s' "$BRANCH_NAME" | sha1sum | head -c 2)"
  PORT_OFFSET=$((0x$offset_hex % 100))
  DB_PORT=$((5432 + PORT_OFFSET))
  BACKEND_PORT=$((8000 + PORT_OFFSET))
  FRONTEND_PORT=$((3000 + PORT_OFFSET))
  # Dedicated testing-only ports for ephemeral containers/scripts
  TEST_DB_PORT=$((15432 + PORT_OFFSET))
  TEST_BACKEND_PORT=$((18000 + PORT_OFFSET))
  TEST_FRONTEND_PORT=$((13000 + PORT_OFFSET))
  DATABASE_URL="postgresql://nutrition_user:nutrition_pass@localhost:$DB_PORT/nutrition"
  export REPO_ROOT BRANCH_NAME BRANCH_SANITIZED COMPOSE_PROJECT PORT_OFFSET \
    DB_PORT BACKEND_PORT FRONTEND_PORT TEST_DB_PORT TEST_BACKEND_PORT TEST_FRONTEND_PORT DATABASE_URL
}
