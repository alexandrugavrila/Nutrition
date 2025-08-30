# scripts/lib/branch-env.ps1
# Shared helpers for branch-specific environment variables.

function Get-RepoRoot {
  git rev-parse --show-toplevel
}

function Get-SanitizedBranch {
  param(
    [string]$Branch
  )
  if (-not $Branch) {
    $Branch = (git rev-parse --abbrev-ref HEAD).Trim()
  }
  return ($Branch.ToLower() -replace '[^a-z0-9]', '-').Trim('-')
}

# Compute branch-specific environment variables and export them.
# Returns a hashtable with RepoRoot, Branch, Sanitized, Project, and PortOffset.
function Set-BranchEnv {
  $repoRoot = Get-RepoRoot
  $branch   = (git -C $repoRoot rev-parse --abbrev-ref HEAD).Trim()
  $sanitized = Get-SanitizedBranch $branch
  $project  = "nutrition-$sanitized"
  $offset   = [math]::Abs($branch.GetHashCode()) % 100

  $env:REPO_ROOT       = $repoRoot
  $env:BRANCH_NAME     = $branch
  $env:BRANCH_SANITIZED= $sanitized
  $env:COMPOSE_PROJECT = $project
  $env:PORT_OFFSET     = $offset
  $env:DB_PORT         = 5432 + $offset
  $env:BACKEND_PORT    = 8000 + $offset
  $env:FRONTEND_PORT   = 3000 + $offset
  $env:DATABASE_URL    = "postgresql://nutrition_user:nutrition_pass@localhost:$($env:DB_PORT)/nutrition"

  return @{ RepoRoot=$repoRoot; Branch=$branch; Sanitized=$sanitized; Project=$project; PortOffset=$offset }
}

