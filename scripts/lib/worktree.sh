#!/usr/bin/env bash
# scripts/lib/worktree.sh
# Helpers for ensuring branch-specific git worktrees exist.

# ensure_worktree: guarantee a branch-specific worktree exists for the current branch.
ensure_worktree() {
  local root branch sanitized parent dir
  root="$(git rev-parse --show-toplevel)"
  branch="$(git rev-parse --abbrev-ref HEAD)"
  sanitized="$(branch_env_sanitize_branch "$branch")"

  # Is the current branch already mapped to this directory?
  if git worktree list --porcelain | awk '
      /^worktree /{wt=$2} /^branch /{br=$2}
      br=="refs/heads/'"$branch"'" && wt=="'"$root"'" {found=1}
      END{exit !found}'; then
    return 0
  fi

  parent="$(dirname "$root")"
  dir="$parent/nutrition-$sanitized"
  echo "Creating worktree for $branch at $dir"
  git worktree add "$dir" "$branch"
  cd "$dir"
}
