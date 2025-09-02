# Shared helpers for docker compose stack checks tied to branch-env.
. "$PSScriptRoot/branch-env.ps1"

function Test-ComposeRunning([string]$Project) {
  $ids = docker compose -p $Project ps -q 2>$null
  return [bool]$ids
}

function Ensure-BranchContainers {
  $envInfo = Set-BranchEnv
  if (-not (Test-ComposeRunning $envInfo.Project)) {
    Write-Warning "Warning: no containers running for branch '$($envInfo.Branch)'. Run the compose script first."
    exit 1
  }
  return $envInfo
}

function Get-TestProject {
  $envInfo = Set-BranchEnv
  return "$($envInfo.Project)-test"
}

