#!/usr/bin/env bash
# scripts/repo/audit-container-sets.sh
# Audits Docker Compose projects whose names follow the nutrition-<sanitized-branch>
# convention and reports container sets that no longer map to an existing local or
# remote branch. Intended to catch leftover stacks after a branch has been removed.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: scripts/repo/audit-container-sets.sh [options]

Options:
  --yes      Automatically confirm removal of orphaned container sets.
  -h, --help Show this help message.
USAGE
}

YES_TO_ALL=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      YES_TO_ALL=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf '[CONTAINER AUDIT] ERROR: Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd -P)"

# Load sanitization helpers for branch names.
source "$ROOT_DIR/scripts/lib/branch-env.sh"

info() { printf '[CONTAINER AUDIT] %s\n' "$*"; }

# Short-circuit if Docker is unavailable; the audit is advisory.
if ! command -v docker >/dev/null 2>&1; then
  info 'Docker CLI not found. Skipping container set audit.'
  exit 0
fi

if ! docker version --format '{{.Server.Version}}' >/dev/null 2>&1; then
  info 'Docker daemon is not reachable. Skipping container set audit.'
  exit 0
fi

repo_root="$(git -C "$ROOT_DIR" rev-parse --show-toplevel)"
if [[ -z "$repo_root" ]]; then
  printf '[CONTAINER AUDIT] ERROR: Unable to determine repository root.\n' >&2
  exit 1
fi

# Map sanitized branch names to a representative description (local preferred).
declare -A sanitized_to_desc=()
register_branch() {
  local sanitized="$1" desc="$2"
  if [[ -z "$sanitized" ]]; then
    return
  fi
  if [[ -z "${sanitized_to_desc[$sanitized]:-}" ]]; then
    sanitized_to_desc[$sanitized]="$desc"
  fi
}

while IFS= read -r branch || [[ -n "$branch" ]]; do
  [[ -z "$branch" ]] && continue
  register_branch "$(branch_env_sanitize_branch "$branch")" "$branch"
done < <(git -C "$repo_root" for-each-ref --format '%(refname:short)' refs/heads)

while IFS= read -r ref || [[ -n "$ref" ]]; do
  [[ -z "$ref" ]] && continue
  case "$ref" in
    */HEAD) continue ;;
  esac
  branch="$ref"
  if [[ "$ref" == */* ]]; then
    branch="${ref#*/}"
  fi
  register_branch "$(branch_env_sanitize_branch "$branch")" "$branch (remote)"
done < <(git -C "$repo_root" for-each-ref --format '%(refname:short)' refs/remotes)

# Discover Docker Compose projects associated with the nutrition stack naming scheme.
declare -A project_seen=()
add_projects_from_text() {
  local text="$1"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" == '<no value>' ]] && continue
    project_seen["$line"]=1
  done <<<"$text"
}

compose_names=$(docker compose ls --format '{{.Name}}' 2>/dev/null || true)
if [[ -n "${compose_names//[[:space:]]/}" ]]; then
  add_projects_from_text "$compose_names"
fi

if ((${#project_seen[@]} == 0)); then
  compose_json=$(docker compose ls --format json 2>/dev/null || true)
  if [[ -n "${compose_json//[[:space:]]/}" ]]; then
    python_cmd=""
    if command -v python3 >/dev/null 2>&1; then
      python_cmd="python3"
    elif command -v python >/dev/null 2>&1; then
      python_cmd="python"
    fi
    if [[ -n "$python_cmd" ]]; then
      while IFS= read -r name || [[ -n "$name" ]]; do
        [[ -z "$name" ]] && continue
        project_seen["$name"]=1
      done < <(printf '%s' "$compose_json" | "$python_cmd" - <<'PY'
import json, sys
try:
    data = json.load(sys.stdin)
except json.JSONDecodeError:
    sys.exit(0)
if isinstance(data, dict):
    items = [data]
else:
    items = data or []
for item in items:
    name = item.get("Name")
    if name:
        print(name)
PY
      )
    fi
  fi
fi

if ((${#project_seen[@]} == 0)); then
  compose_labels=$(docker ps -a --format '{{.Label "com.docker.compose.project"}}' 2>/dev/null || true)
  if [[ -n "${compose_labels//[[:space:]]/}" ]]; then
    add_projects_from_text "$compose_labels"
  fi
fi

if ((${#project_seen[@]} == 0)); then
  info 'No Docker Compose projects detected. Nothing to audit.'
  exit 0
fi

mapfile -t projects < <(printf '%s\n' "${!project_seen[@]}" | sort)

prefix="${CONTAINER_SET_PREFIX:-nutrition-}"
orphans=()

for project in "${projects[@]}"; do
  if [[ "$project" != "$prefix"* ]]; then
    continue
  fi
  suffix="${project#${prefix}}"
  [[ -z "$suffix" ]] && continue

  candidates=()
  candidates+=("$suffix")
  if [[ "$suffix" == *-test ]]; then
    base="${suffix%-test}"
    [[ -n "$base" ]] && candidates+=("$base")
  fi

  match_desc=""
  for candidate in "${candidates[@]}"; do
    if [[ -n "${sanitized_to_desc[$candidate]:-}" ]]; then
      match_desc="${sanitized_to_desc[$candidate]}"
      break
    fi
  done

  if [[ -n "$match_desc" ]]; then
    info "Container set '$project' matches branch '$match_desc' (OK)"
  else
    candidate_str="${candidates[*]}"
    candidate_str="${candidate_str// /, }"
    info "Container set '$project' has no matching branch (checked sanitized names: $candidate_str)."
    orphans+=("$project|$candidate_str")
  fi
done

if ((${#orphans[@]} == 0)); then
  info 'All container sets map to existing branches.'
  exit 0
fi

unresolved=()
interactive=true
if [[ ! -t 0 || ! -t 1 ]]; then
  interactive=false
fi

for entry in "${orphans[@]}"; do
  project="${entry%%|*}"
  candidate_str="${entry#*|}"
  response=""
  if [[ "$YES_TO_ALL" == true ]]; then
    info "Automatically removing container set '$project' (--yes specified)."
    response="y"
  elif [[ "$interactive" == true ]]; then
    read -r -p "Remove orphaned container set '$project'? (y/N) " response || response=""
  else
    info "Non-interactive shell detected; skipping automatic removal for '$project'."
  fi

  if [[ "$response" =~ ^[Yy]$ ]]; then
    info "Removing container set '$project'..."
    if docker compose -p "$project" down -v --remove-orphans; then
      info "Removed container set '$project'."
    else
      printf '[CONTAINER AUDIT] ERROR: Failed to remove container set %s. Run: docker compose -p %s down -v --remove-orphans\n' "$project" "$project" >&2
      unresolved+=("$project|$candidate_str")
    fi
  else
    info "Keeping container set '$project'."
    unresolved+=("$project|$candidate_str")
  fi
done

if ((${#unresolved[@]} > 0)); then
  for entry in "${unresolved[@]}"; do
    project="${entry%%|*}"
    candidate_str="${entry#*|}"
    printf '[CONTAINER AUDIT] ERROR: Container set %s has no matching branch (checked sanitized names: %s). Remove with: docker compose -p %s down -v --remove-orphans\n' "$project" "$candidate_str" "$project" >&2
  done
  exit 1
fi

info 'All container sets map to existing branches.'
