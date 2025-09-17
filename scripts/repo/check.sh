#!/usr/bin/env bash
# scripts/repo/check.sh
# Orchestrates repository health checks by syncing branches, auditing worktrees, and flagging stale container sets.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/repo/check.sh [options]

Runs sync-branches followed by audit-worktrees and container-set auditing. Non-control options are passed
to sync-branches. Use --skip-sync, --skip-audit, or --skip-containers to bypass individual steps.
USAGE
}

SYNC_ARGS=()
SKIP_SYNC=false
SKIP_AUDIT=false
SKIP_CONTAINERS=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-sync)
      SKIP_SYNC=true
      ;;
    --skip-audit)
      SKIP_AUDIT=true
      ;;
    --skip-containers)
      SKIP_CONTAINERS=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      while [[ $# -gt 0 ]]; do
        SYNC_ARGS+=("$1")
        shift
      done
      break
      ;;
    *)
      SYNC_ARGS+=("$1")
      ;;
  esac
  shift || break
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

if [[ "$SKIP_SYNC" == false ]]; then
  "$SCRIPT_DIR/sync-branches.sh" "${SYNC_ARGS[@]}"
fi

if [[ "$SKIP_AUDIT" == false ]]; then
  "$SCRIPT_DIR/audit-worktrees.sh"
fi

if [[ "$SKIP_CONTAINERS" == false ]]; then
  "$SCRIPT_DIR/audit-container-sets.sh"
fi
