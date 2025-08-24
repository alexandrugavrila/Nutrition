#!/usr/bin/env bash
# scripts/compose-down-branch.sh
set -euo pipefail

prune_images=false
force=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prune-images) prune_images=true ;;
    --force) force=true ;;
    *) echo "Usage: $(basename "$0") [--prune-images] [--force]" >&2; exit 1 ;;
  esac
  shift
done

get_compose_projects() {
  local prefix=${1:-nutrition-}
  local projects=""
  local json
  json=$(docker compose ls --format json 2>/dev/null || true)
  if [[ -n "$json" ]]; then
    projects=$(echo "$json" | python - <<'PY'
import sys,json
try:
  items=json.load(sys.stdin)
  for it in items:
    name=it.get('Name')
    if name:
      print(name)
except Exception:
  pass
PY
    )
    projects=$(echo "$projects" | grep "^$prefix" || true)
  fi
  if [[ -z "$projects" ]]; then
    projects=$(docker ps -a --format '{{.Label "com.docker.compose.project"}}' 2>/dev/null | grep "^$prefix" | sort -u || true)
  fi
  echo "$projects"
}

prioritize_current_branch() {
  local projects=("$@")
  local branch sanitized current
  branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
  if [[ -n "$branch" ]]; then
    sanitized=$(echo "$branch" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/^[-]*//;s/[-]*$//')
    current="nutrition-$sanitized"
    if printf '%s\n' "${projects[@]}" | grep -qx "$current"; then
      echo "$current"
      for p in "${projects[@]}"; do
        [[ "$p" == "$current" ]] || echo "$p"
      done
      return
    fi
  fi
  printf '%s\n' "${projects[@]}"
}

select_projects() {
  local projects=("$@")
  if [[ ${#projects[@]} -eq 0 ]]; then
    echo "No Compose projects found with the expected prefix." >&2
    return
  fi
  echo "Select project(s) to delete:"
  for i in "${!projects[@]}"; do
    printf "%2d) %s\n" $((i+1)) "${projects[i]}"
  done
  read -r -p "Enter space-separated numbers or 'all': " input
  [[ -z "$input" ]] && return
  if [[ "$input" == "all" ]]; then
    printf '%s\n' "${projects[@]}"
    return
  fi
  local selection=()
  for idx in $input; do
    if [[ "$idx" =~ ^[0-9]+$ ]] && (( idx>=1 && idx<=${#projects[@]} )); then
      selection+=("${projects[idx-1]}")
    fi
  done
  printf '%s\n' "${selection[@]}" | sort -u
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

mapfile -t projects < <(get_compose_projects)
mapfile -t projects < <(prioritize_current_branch "${projects[@]}")

[[ ${#projects[@]} -eq 0 ]] && exit 0

mapfile -t chosen < <(select_projects "${projects[@]}")
if [[ ${#chosen[@]} -eq 0 ]]; then
  echo "Nothing selected. Exiting."
  exit 0
fi

if ! $force; then
  echo "You are about to delete the following Compose project(s):"
  for p in "${chosen[@]}"; do
    echo "  - $p"
  done
  read -r -p "Type 'yes' to proceed: " confirm
  if [[ "$confirm" != "yes" ]]; then
    echo "Cancelled."
    exit 0
  fi
fi

for proj in "${chosen[@]}"; do
  echo "Bringing down '$proj'..."
  args=(compose -p "$proj" down -v --remove-orphans)
  $prune_images && args+=(--rmi local)
  docker "${args[@]}"
  defaultNet="${proj}_default"
  docker network rm "$defaultNet" >/dev/null 2>&1 || true
fi

echo "Done."
