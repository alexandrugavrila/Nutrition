#!/usr/bin/env bash
# scripts/env/check.sh
# Verifies that:
# - You are in the correct worktree directory for the current branch
# - The default branch (e.g. main) lives in the primary repo root
# - A Python virtual environment is activated for this worktree

set -euo pipefail

FIX=false
if [[ "${1:-}" == "--fix" ]]; then
  FIX=true
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Load helpers
source "$(dirname "${BASH_SOURCE[0]}")/../lib/branch-env.sh"
source "$(dirname "${BASH_SOURCE[0]}")/../lib/worktree.sh"

fail() { echo "[ENV CHECK] ERROR: $*" >&2; exit 1; }
info() { echo "[ENV CHECK] $*"; }

repo_root="$(_wt_repo_root)"
branch="$(git -C "$repo_root" rev-parse --abbrev-ref HEAD)"
[[ -n "$branch" && "$branch" != HEAD ]] || fail "Detached HEAD is not supported. Please checkout a branch."
sanitized="$(branch_env_sanitize_branch "$branch")"
parent="$(dirname "$repo_root")"
desired="$parent/nutrition-$sanitized"
base="$(_wt_default_branch)"

# Compute primary (common) repo root from the common .git directory
common_git_dir="$(git -C "$repo_root" rev-parse --git-common-dir)"
primary_root="$(cd "$common_git_dir/.." && pwd)"

info "Repository root: $repo_root"
info "Primary root:    $primary_root"
info "Current branch:  $branch"
info "Default branch:  $base"

# Verify correct worktree placement
if [[ "$branch" == "$base" ]]; then
  if [[ "$repo_root" != "$primary_root" ]]; then
    fail "Default branch '$base' should be in primary root: $primary_root"
  fi
else
  if [[ "$repo_root" != "$desired" ]]; then
    if [[ ! -d "$desired" ]]; then
      # If the branch already has a worktree at the desired path, prefer using it.
      existing="$(_wt_find_for_branch "$branch" 2>/dev/null || true)"
      if [[ -n "$existing" && "$existing" == "$desired" ]]; then
        info "Found existing worktree for '$branch' at: $existing"
        if $FIX; then
          info "Run: cd '$existing'"
        else
          fail "Branch '$branch' already has a worktree at: $existing"
        fi
        exit 0
      fi
      if $FIX; then
        info "Creating worktree for '$branch' at '$desired'..."
        # If branch is currently checked out in the primary root, free it by switching to base
        if [[ "$(git -C "$primary_root" rev-parse --abbrev-ref HEAD)" == "$branch" ]]; then
          if [[ -n "$(git -C "$primary_root" status --porcelain)" ]]; then
            fail "Primary worktree ($primary_root) has uncommitted changes. Commit/stash before auto-creating worktree."
          fi
          info "Switching primary worktree to '$base' to free branch..."
          git -C "$primary_root" switch "$base"
        fi
        git worktree add "$desired" "$branch"
        info "Created worktree. Since shell cwd cannot be changed by a child process, run:"
        info "  cd '$desired'"
        # Pre-create the venv for convenience
        if [[ -x "$desired/scripts/env/activate-venv.sh" ]]; then
          info "Bootstrapping venv in the new worktree..."
          bash "$desired/scripts/env/activate-venv.sh" || true
        fi
      else
        fail "Branch '$branch' should be in its dedicated worktree, but that folder does not exist. Expected: $desired
Create it with:
  git worktree add ../nutrition-$sanitized $branch"
      fi
    else
      if $FIX; then
        info "Switching to existing worktree directory: $desired"
        info "Run: cd '$desired'"
      else
        fail "Branch '$branch' is not in its dedicated worktree. Expected: $desired"
      fi
    fi
  fi
fi

# Ensure worktree mapping exists for this branch and directory
if ! git worktree list --porcelain | awk -v want_wt="$repo_root" -v want_br="refs/heads/$branch" '
  /^worktree /{wt=$2}
  /^branch /{br=$2}
  /^$/ {if (wt==want_wt && br==want_br) found=1}
  END{exit !found}
'; then
  fail "Git worktree mapping not found for branch '$branch' at '$repo_root'"
fi

info "Worktree mapping OK."

# Verify python is available before checking the venv
if ! command -v python >/dev/null 2>&1; then
  fail "Python is not installed or not on PATH. Please install Python 3 and ensure the 'python' command is available."
fi

# Verify Python venv is active and matches this worktree
expected_venv="$repo_root/.venv"
actual_venv="${VIRTUAL_ENV:-}"

if [[ -z "$actual_venv" ]]; then
  fail "Python virtual environment is not activated. Run: ./scripts/env/activate-venv.sh"
fi

if [[ "$actual_venv" != "$expected_venv" ]]; then
  fail "VIRTUAL_ENV points to a different directory:
  expected: $expected_venv
  actual:   $actual_venv"
fi

# Double-check the running python belongs to this venv
py_exec="$(python -c 'import sys,os;print(os.path.abspath(sys.executable))' 2>/dev/null || true)"
if [[ -z "$py_exec" ]]; then
  fail "Unable to locate python executable. Is the venv active?"
fi
case "$py_exec" in
  "$expected_venv"/bin/*|"$expected_venv"/Scripts/*) ;;
  *) fail "Active python ($py_exec) is not from this worktree venv: $expected_venv" ;;
esac

info "Python venv OK: $expected_venv"
info "Environment looks good."
