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
  # Stable per-branch offset (use SHA1 first byte, like bash version)
  $sha1    = [System.Security.Cryptography.SHA1]::Create()
  try {
    $bytes  = [System.Text.Encoding]::UTF8.GetBytes($branch)
    $hash   = $sha1.ComputeHash($bytes)
  } finally {
    $sha1.Dispose()
  }
  $offset  = [int]($hash[0] % 100)

  $env:REPO_ROOT       = $repoRoot
  $env:BRANCH_NAME     = $branch
  $env:BRANCH_SANITIZED= $sanitized
  $env:COMPOSE_PROJECT = $project
  $env:PORT_OFFSET     = $offset
  $env:DEV_DB_PORT         = 5432 + $offset
  $env:DEV_BACKEND_PORT    = 8000 + $offset
  $env:DEV_FRONTEND_PORT   = 3000 + $offset
  # Dedicated testing-only ports for ephemeral containers/scripts
  $env:TEST_DB_PORT         = 15432 + $offset
  $env:TEST_BACKEND_PORT    = 18000 + $offset
  $env:TEST_FRONTEND_PORT   = 13000 + $offset
  $env:DATABASE_URL    = "postgresql://nutrition_user:nutrition_pass@localhost:$($env:DEV_DB_PORT)/nutrition"

  return @{ RepoRoot=$repoRoot; Branch=$branch; Sanitized=$sanitized; Project=$project; PortOffset=$offset }
}

