#!/usr/bin/env bash
# scripts/lib/worktree.sh
# Helpers for ensuring branch-specific git worktrees exist.

# Resolve the repository root
_wt_repo_root() {
  git rev-parse --show-toplevel
}

# Resolve the default base branch (prefers origin/HEAD, then main, then master)
_wt_default_branch() {
  local def
  def=$(git symbolic-ref -q --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##') || true
  if [[ -n "$def" ]]; then
    printf '%s\n' "$def"
    return 0
  fi
  if git show-ref --verify --quiet refs/heads/main; then printf 'main\n'; return 0; fi
  if git show-ref --verify --quiet refs/heads/master; then printf 'master\n'; return 0; fi
  printf 'main\n'
}

# Find an existing worktree path for a branch; prints path if found
_wt_find_for_branch() {
  local branch="${1:?branch required}"
  git worktree list --porcelain | awk -v target="refs/heads/""$branch" '
    /^worktree /{wt=$2}
    /^branch /{br=$2}
    br==target {print wt; found=1}
    END{exit !found}
  '
}

# ensure_worktree: guarantee a dedicated sibling worktree exists for the current branch
# Behavior:
# - Keeps the default branch (e.g. main) in the original root
# - For any other branch, ensures a sibling directory ../nutrition-<sanitized-branch>
#   exists as a worktree for that branch and cds into it.
ensure_worktree() {
  local root branch sanitized parent desired existing base
  root="$(_wt_repo_root)"
  branch="$(git -C "$root" rev-parse --abbrev-ref HEAD)"
  if [[ "$branch" == "HEAD" || -z "$branch" ]]; then
    echo "ensure_worktree: Detached HEAD is not supported. Please checkout a branch." >&2
    return 1
  fi
  sanitized="$(branch_env_sanitize_branch "$branch")"
  parent="$(dirname "$root")"
  desired="$parent/nutrition-$sanitized"
  base="$(_wt_default_branch)"

  # If we're already in the desired directory, nothing to do.
  if [[ "$root" == "$desired" ]]; then
    return 0
  fi

  # If a worktree already exists for this branch at the desired location, use it.
  if existing="$(_wt_find_for_branch "$branch")"; then
    if [[ -n "$existing" && "$existing" == "$desired" ]]; then
      cd "$existing"
      return 0
    fi
  fi

  # If this is the default branch, keep it in the primary root.
  if [[ "$branch" == "$base" ]]; then
    cd "$root"
    return 0
  fi

  # We need to create a new worktree for this branch at the desired path.
  # If this branch is currently checked out in the primary root, we must free it first.
  if git -C "$root" rev-parse --abbrev-ref HEAD | grep -qx "$branch"; then
    # Require a clean tree before switching branches automatically.
    if [[ -n "$(git -C "$root" status --porcelain)" ]]; then
      echo "ensure_worktree: Cannot create dedicated worktree for '$branch' because the current worktree ($root) has uncommitted changes." >&2
      echo "Please commit or stash your changes, or manually create the worktree with:" >&2
      echo "  git switch $base" >&2
      echo "  git worktree add '$desired' '$branch'" >&2
      return 1
    fi
    echo "Switching primary worktree to '$base' to free branch '$branch'..."
    git -C "$root" switch "$base"
  fi

  echo "Creating worktree for $branch at $desired"
  git worktree add "$desired" "$branch"
  cd "$desired"
}
