#!/usr/bin/env bash
# scripts/repo/audit-worktrees.sh
# Audits all git worktrees to ensure each branch maps to exactly one worktree
# and each worktree follows the expected nutrition-<branch> naming convention.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Load helpers
source "$ROOT_DIR/scripts/lib/branch-env.sh"
source "$ROOT_DIR/scripts/lib/worktree.sh"

info() { echo "[WORKTREE AUDIT] $*"; }
add_error() { errors+=("$1"); }

errors=()

repo_root="$(_wt_repo_root)"
common_git_dir="$(git -C "$repo_root" rev-parse --git-common-dir)"
if [[ "$common_git_dir" != /* ]]; then
  common_git_dir="$repo_root/$common_git_dir"
fi
primary_root="$(cd "$common_git_dir/.." && pwd)"
parent_dir="$(dirname "$primary_root")"
default_branch="$(_wt_default_branch)"

info "Primary worktree root: $primary_root"
info "Worktree parent dir:  $parent_dir"
info "Default branch:       $default_branch"

declare -A branch_to_worktree=()
declare -A expected_to_branch=()

current_wt=""
current_branch=""
current_detached=false

process_entry() {
  local wt="$current_wt"
  local branch_ref="$current_branch"
  local detached="$current_detached"

  if [[ -z "$wt" ]]; then
    return
  fi

  if [[ ! -d "$wt" ]]; then
    add_error "Worktree path does not exist: $wt"
    wt=""
  fi

  if [[ "$detached" == true ]]; then
    add_error "Worktree '$wt' is in a detached HEAD state. Attach it to a branch."
  elif [[ -z "$branch_ref" ]]; then
    add_error "Worktree '$wt' is missing branch information."
  elif [[ "$branch_ref" != refs/heads/* ]]; then
    add_error "Worktree '$wt' is attached to unexpected ref '$branch_ref' (expected refs/heads/...)."
  else
    local branch="${branch_ref#refs/heads/}"

    if [[ -n "${branch_to_worktree[$branch]:-}" ]]; then
      add_error "Branch '$branch' has multiple worktrees: '${branch_to_worktree[$branch]}' and '$wt'"
    else
      branch_to_worktree[$branch]="$wt"
    fi

    local sanitized expected
    if [[ "$branch" == "$default_branch" ]]; then
      expected="$primary_root"
    else
      sanitized="$(branch_env_sanitize_branch "$branch")"
      expected="$parent_dir/nutrition-$sanitized"
    fi

    if [[ -n "${expected_to_branch[$expected]:-}" && "${expected_to_branch[$expected]}" != "$branch" ]]; then
      add_error "Branches '$branch' and '${expected_to_branch[$expected]}' both map to expected worktree '$expected'."
    else
      expected_to_branch[$expected]="$branch"
    fi

    if [[ "$wt" != "$expected" ]]; then
      if [[ "$branch" == "$default_branch" ]]; then
        add_error "Default branch '$branch' should be in '$expected' but worktree is at '$wt'"
      else
        add_error "Worktree for branch '$branch' should be '$expected' but found '$wt'"
      fi
    else
      info "Branch '$branch' -> $wt (OK)"
    fi
  fi

  current_wt=""
  current_branch=""
  current_detached=false
}

while IFS= read -r line || [[ -n "$line" ]]; do
  if [[ -z "$line" ]]; then
    process_entry
    continue
  fi
  case "$line" in
    worktree\ *)
      current_wt="${line#worktree }"
      ;;
    branch\ *)
      current_branch="${line#branch }"
      ;;
    detached)
      current_detached=true
      ;;
    *)
      # Ignore other metadata (HEAD, bare, etc.)
      ;;
  esac
done < <(git -C "$repo_root" worktree list --porcelain)

# Process the last entry if file didn't end with newline
process_entry

if ((${#errors[@]} > 0)); then
  for err in "${errors[@]}"; do
    echo "[WORKTREE AUDIT] ERROR: $err" >&2
  done
  exit 1
fi

info "All worktrees match the expected layout."
