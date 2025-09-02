#!/usr/bin/env bash
# Shared helpers for docker compose stack checks tied to branch-env.

# Returns 0 if any containers are running for the current COMPOSE_PROJECT
compose_has_running() {
  local proj="${COMPOSE_PROJECT:-}"
  if [[ -z "$proj" ]]; then
    echo "compose_has_running: COMPOSE_PROJECT is not set (did you call branch_env_load?)" >&2
    return 2
  fi
  local ids
  ids=$(docker compose -p "$proj" ps -q 2>/dev/null || true)
  [[ -n "$ids" ]]
}

require_branch_containers() {
  if ! compose_has_running; then
    echo "Warning: no containers running for branch '${BRANCH_NAME:-unknown}'. Run the compose script first." >&2
    return 1
  fi
}

compose_test_project() {
  if [[ -z "${COMPOSE_PROJECT:-}" ]]; then
    echo "compose_test_project: COMPOSE_PROJECT is not set" >&2
    return 2
  fi
  printf '%s-test\n' "$COMPOSE_PROJECT"
}

