#!/usr/bin/env bash
# scripts/repo/check.sh
# Orchestrates repository health checks by syncing branches and auditing worktrees.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/repo/check.sh [options]

Runs sync-branches followed by audit-worktrees. Non-control options are passed
to sync-branches. Use --skip-sync or --skip-audit to bypass individual steps.
USAGE
}

SYNC_ARGS=()
SKIP_SYNC=false
SKIP_AUDIT=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-sync)
      SKIP_SYNC=true
      ;;
    --skip-audit)
      SKIP_AUDIT=true
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
