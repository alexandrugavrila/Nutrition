#!/usr/bin/env bash
# scripts/env/sync-worktrees.sh
# Synchronizes local git branches and worktrees with the remote origin.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/env/sync-worktrees.sh [options]

Options:
  --no-fetch   Skip fetching remote updates before syncing.
  --yes        Answer yes to all confirmations.
  --dry-run    Show the actions that would be performed without making changes.
  -h, --help   Show this help message.
USAGE
}

info() {
  printf '[WORKTREE SYNC] %s\n' "$*"
}

warn() {
  printf '[WORKTREE SYNC] WARNING: %s\n' "$*" >&2
}

confirm() {
  local prompt="${1:?prompt required}"
  if [[ "$YES_TO_ALL" == true ]]; then
    return 0
  fi
  read -r -p "$prompt (y/N) " response
  [[ "$response" =~ ^[Yy]$ ]]
}

normalize_path() {
  local path="$1"
  if [[ -z "$path" ]]; then
    return 0
  fi

  local result
  if command -v python3 >/dev/null 2>&1; then
    if result=$(python3 - "$path" <<'PY'
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
    ); then
      printf '%s\n' "$result"
      return 0
    fi
  elif command -v python >/dev/null 2>&1; then
    if result=$(python - "$path" <<'PY'
import os, sys
print(os.path.abspath(sys.argv[1]))
PY
    ); then
      printf '%s\n' "$result"
      return 0
    fi
  fi

  if command -v realpath >/dev/null 2>&1; then
    if result=$(realpath "$path" 2>/dev/null); then
      printf '%s\n' "$result"
      return 0
    fi
  fi

  local dir base
  dir=$(dirname "$path" 2>/dev/null || printf '.')
  base=$(basename "$path")
  if [[ -d "$dir" ]]; then
    (
      cd "$dir" 2>/dev/null && printf '%s/%s\n' "$(pwd -P)" "$base"
    ) && return 0
  fi
  printf '%s\n' "$path"
}

NO_FETCH=false
YES_TO_ALL=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-fetch) NO_FETCH=true ;;
    --yes) YES_TO_ALL=true ;;
    --dry-run) DRY_RUN=true ;;
    -h|--help)
      usage
      exit 0
      ;;
    -* )
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 1
      ;;
    * )
      printf 'Unexpected argument: %s\n\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd -P)"

source "$ROOT_DIR/scripts/lib/branch-env.sh"
source "$ROOT_DIR/scripts/lib/worktree.sh"

repo_root="$(_wt_repo_root)"
if [[ -z "$repo_root" ]]; then
  printf '[WORKTREE SYNC] Failed to resolve repository root.\n' >&2
  exit 1
fi
repo_root="$(normalize_path "$repo_root")"
info "Repository root: $repo_root"

if [[ "$NO_FETCH" == false ]]; then
  info 'Fetching remote updates (git fetch --prune)...'
  fetch_output=''
  if ! fetch_output=$(git -C "$repo_root" fetch --prune 2>&1); then
    warn 'git fetch failed:'
    if [[ -n "$fetch_output" ]]; then
      while IFS= read -r line || [[ -n "$line" ]]; do
        warn "$line"
      done <<<"$fetch_output"
    fi
    exit 1
  fi
  if [[ -n "$fetch_output" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      info "$line"
    done <<<"$fetch_output"
  fi
fi

default_branch="$(_wt_default_branch)"
info "Default branch: $default_branch"

common_git_dir="$(git -C "$repo_root" rev-parse --git-common-dir | tr -d '\r')"
if [[ "$common_git_dir" != /* && ! "$common_git_dir" =~ ^[A-Za-z]:/ ]]; then
  common_git_dir="$repo_root/$common_git_dir"
fi
common_git_dir="$(normalize_path "$common_git_dir")"
primary_root="$(cd "$common_git_dir/.." && pwd -P)"
parent_dir="$(dirname "$primary_root")"

declare -a local_branches=()
mapfile -t local_branches < <(git -C "$repo_root" for-each-ref --format '%(refname:short)' refs/heads | tr -d '\r' | awk 'NF')

declare -a remote_branches_raw=()
mapfile -t remote_branches_raw < <(git -C "$repo_root" for-each-ref --format '%(refname:short)' refs/remotes/origin | tr -d '\r' | awk 'NF')

declare -a remote_branches=()
for ref in "${remote_branches_raw[@]}"; do
  if [[ "$ref" == "origin/HEAD" ]]; then
    continue
  fi
  if [[ "$ref" == origin/* ]]; then
    remote_branches+=("${ref#origin/}")
  fi
done

declare -A local_set=()
for branch in "${local_branches[@]}"; do
  local_set["$branch"]=1
done

declare -A remote_set=()
for branch in "${remote_branches[@]}"; do
  remote_set["$branch"]=1
done

local_only=()
for branch in "${local_branches[@]}"; do
  if [[ -z "${remote_set[$branch]:-}" ]]; then
    local_only+=("$branch")
  fi
done

remote_only=()
for branch in "${remote_branches[@]}"; do
  if [[ -z "${local_set[$branch]:-}" ]]; then
    remote_only+=("$branch")
  fi
done

sorted_local_only=()
if ((${#local_only[@]} > 0)); then
  mapfile -t sorted_local_only < <(printf '%s\n' "${local_only[@]}" | sort)
  info 'Local branches without matching origin branch:'
  for branch in "${sorted_local_only[@]}"; do
    info "  $branch"
  done
else
  info 'No extra local branches found.'
fi

sorted_remote_only=()
if ((${#remote_only[@]} > 0)); then
  mapfile -t sorted_remote_only < <(printf '%s\n' "${remote_only[@]}" | sort)
  info 'Remote branches without local copies:'
  for branch in "${sorted_remote_only[@]}"; do
    info "  $branch"
  done
  info 'Create local branches/worktrees for these when you are ready to work on them.'
fi

declare -a WT_PATHS=()
declare -a WT_BRANCH_REFS=()
declare -a WT_DETACHED=()

load_worktrees() {
  WT_PATHS=()
  WT_BRANCH_REFS=()
  WT_DETACHED=()
  local current_wt=''
  local current_branch=''
  local current_detached='false'
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ -z "$line" ]]; then
      if [[ -n "$current_wt" ]]; then
        WT_PATHS+=("$current_wt")
        WT_BRANCH_REFS+=("$current_branch")
        WT_DETACHED+=("$current_detached")
      fi
      current_wt=''
      current_branch=''
      current_detached='false'
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
        current_detached='true'
        ;;
      *)
        ;;
    esac
  done < <(git -C "$repo_root" worktree list --porcelain | tr -d '\r')
  if [[ -n "$current_wt" ]]; then
    WT_PATHS+=("$current_wt")
    WT_BRANCH_REFS+=("$current_branch")
    WT_DETACHED+=("$current_detached")
  fi
}

load_worktrees

if ((${#local_only[@]} > 0)); then
  for branch in "${sorted_local_only[@]}"; do
    if [[ "$branch" == "$default_branch" ]]; then
      continue
    fi

    branch_worktree_indices=()
    for idx in "${!WT_PATHS[@]}"; do
      if [[ "${WT_BRANCH_REFS[$idx]}" == "refs/heads/$branch" ]]; then
        branch_worktree_indices+=("$idx")
      fi
    done

    if ((${#branch_worktree_indices[@]} == 0)); then
      continue
    fi

    info "Local branch '$branch' is missing from origin."

    remaining_worktrees=false
    for idx in "${branch_worktree_indices[@]}"; do
      wt_path="${WT_PATHS[$idx]}"
      wt_full="$(normalize_path "$wt_path")"
      if [[ "$DRY_RUN" == true ]]; then
        info "Would remove worktree '$wt_full' for branch '$branch'."
        continue
      fi

      if ! confirm "Remove worktree '$wt_full' for branch '$branch'?"; then
        info "Keeping worktree '$wt_full'."
        remaining_worktrees=true
        continue
      fi

      current_dir="$(pwd -P)"
      relocated=false
      if [[ "$current_dir" == "$wt_full" ]]; then
        parent_path="$(dirname "$wt_full")"
        if [[ ! -d "$parent_path" ]]; then
          parent_path="$primary_root"
        fi
        cd "$parent_path"
        relocated=true
      fi

      if output=$(git -C "$repo_root" worktree remove "$wt_path" 2>&1); then
        if [[ -n "$output" ]]; then
          while IFS= read -r line || [[ -n "$line" ]]; do
            info "$line"
          done <<<"$output"
        fi
        info "Removed worktree '$wt_full'."
      else
        warn "Failed to remove worktree '$wt_full'."
        if [[ -n "$output" ]]; then
          while IFS= read -r line || [[ -n "$line" ]]; do
            warn "$line"
          done <<<"$output"
        fi
        remaining_worktrees=true
      fi

      if [[ "$relocated" == true ]]; then
        cd "$current_dir"
      fi
    done

    if [[ "$remaining_worktrees" == true ]]; then
      warn "Branch '$branch' still has active worktrees. Skipping branch deletion."
      continue
    fi

    if [[ "$DRY_RUN" == true ]]; then
      info "Would delete local branch '$branch'."
      continue
    fi

    if ! confirm "Delete local branch '$branch'?"; then
      info "Keeping branch '$branch'."
      continue
    fi

    if delete_output=$(git -C "$repo_root" branch -d "$branch" 2>&1); then
      info "Deleted branch '$branch'."
    else
      if [[ "$delete_output" == *'not fully merged'* ]]; then
        warn "Branch '$branch' is not fully merged."
        if confirm "Force delete branch '$branch'?"; then
          if force_output=$(git -C "$repo_root" branch -D "$branch" 2>&1); then
            info "Force deleted branch '$branch'."
          else
            warn "Failed to force delete branch '$branch'."
            if [[ -n "$force_output" ]]; then
              while IFS= read -r line || [[ -n "$line" ]]; do
                warn "$line"
              done <<<"$force_output"
            fi
          fi
        else
          info "Keeping branch '$branch'."
        fi
      else
        warn "Failed to delete branch '$branch'."
        if [[ -n "$delete_output" ]]; then
          while IFS= read -r line || [[ -n "$line" ]]; do
            warn "$line"
          done <<<"$delete_output"
        fi
      fi
    fi
  done
fi

if [[ "$DRY_RUN" == false ]]; then
  info 'Pruning stale git worktree entries...'
  if prune_output=$(git -C "$repo_root" worktree prune 2>&1); then
    if [[ -n "$prune_output" ]]; then
      while IFS= read -r line || [[ -n "$line" ]]; do
        info "$line"
      done <<<"$prune_output"
    fi
  else
    warn 'git worktree prune failed.'
    if [[ -n "$prune_output" ]]; then
      while IFS= read -r line || [[ -n "$line" ]]; do
        warn "$line"
      done <<<"$prune_output"
    fi
  fi
fi

load_worktrees

declare -A branch_worktree_map=()
for idx in "${!WT_PATHS[@]}"; do
  if [[ "${WT_DETACHED[$idx]}" == "true" ]]; then
    continue
  fi
  ref="${WT_BRANCH_REFS[$idx]}"
  if [[ "$ref" == refs/heads/* ]]; then
    branch="${ref#refs/heads/}"
    path_norm="$(normalize_path "${WT_PATHS[$idx]}")"
    if [[ -z "${branch_worktree_map[$branch]:-}" ]]; then
      branch_worktree_map["$branch"]="$path_norm"
    else
      branch_worktree_map["$branch"]+=$'\n'"$path_norm"
    fi
  fi
done

primary_full="$(normalize_path "$primary_root")"

if [[ -n "${branch_worktree_map[$default_branch]:-}" ]]; then
  has_primary=false
  while IFS= read -r path || [[ -n "$path" ]]; do
    if [[ "$path" == "$primary_full" ]]; then
      has_primary=true
      break
    fi
  done <<<"${branch_worktree_map[$default_branch]}"
  if [[ "$has_primary" == false ]]; then
    warn "Default branch '$default_branch' is not checked out in '$primary_full'."
  fi
else
  warn "Default branch '$default_branch' has no registered worktrees."
fi

sorted_locals=()
if ((${#local_branches[@]} > 0)); then
  mapfile -t sorted_locals < <(printf '%s\n' "${local_branches[@]}" | sort)
fi

for branch in "${sorted_locals[@]}"; do
  if [[ "$branch" == "$default_branch" ]]; then
    continue
  fi
  if [[ -z "${local_set[$branch]:-}" ]]; then
    continue
  fi

  sanitized="$(branch_env_sanitize_branch "$branch")"
  expected="$parent_dir/nutrition-$sanitized"
  expected_full="$(normalize_path "$expected")"

  branch_paths=()
  if [[ -n "${branch_worktree_map[$branch]:-}" ]]; then
    while IFS= read -r path || [[ -n "$path" ]]; do
      branch_paths+=("$path")
    done <<<"${branch_worktree_map[$branch]}"
  fi

  match=false
  for path in "${branch_paths[@]}"; do
    if [[ "$path" == "$expected_full" ]]; then
      match=true
      break
    fi
  done

  if [[ "$match" == true ]]; then
    continue
  fi

  if ((${#branch_paths[@]} > 0)); then
    joined=''
    for path in "${branch_paths[@]}"; do
      if [[ -n "$joined" ]]; then
        joined+=", "
      fi
      joined+="$path"
    done
    warn "Branch '$branch' has worktree(s) in unexpected location(s): $joined"
    continue
  fi

  if [[ -d "$expected_full" ]]; then
    warn "Directory '$expected_full' exists but is not registered as a worktree for '$branch'. Remove it or attach it manually."
    continue
  fi

  if [[ "$DRY_RUN" == true ]]; then
    info "Would create worktree '$expected_full' for branch '$branch'."
    continue
  fi

  if ! confirm "Create worktree '$expected_full' for branch '$branch'?"; then
    info "Skipping worktree creation for '$branch'."
    continue
  fi

  if output=$(git -C "$repo_root" worktree add "$expected" "$branch" 2>&1); then
    if [[ -n "$output" ]]; then
      while IFS= read -r line || [[ -n "$line" ]]; do
        info "$line"
      done <<<"$output"
    fi
    info "Created worktree '$expected_full' for branch '$branch'."
  else
    warn "Failed to create worktree for branch '$branch'."
    if [[ -n "$output" ]]; then
      while IFS= read -r line || [[ -n "$line" ]]; do
        warn "$line"
      done <<<"$output"
    fi
  fi
done

info 'Sync complete. Run scripts/env/audit-worktrees.sh for a final validation if desired.'

