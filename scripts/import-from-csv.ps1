# scripts/import-from-csv.ps1
[CmdletBinding()]
param(
  [switch]$production,
  [switch]$test
)

function Show-Usage {
  Write-Host "Usage: pwsh ./scripts/import-from-csv.ps1 -production|-test" -ForegroundColor Yellow
}

if (([int]$production + [int]$test) -ne 1) {
  Show-Usage
  exit 1
}

$flag = if ($production) { "--production" } else { "--test" }

. "$PSScriptRoot/lib/branch-env.ps1"
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

# Ensure containers are running for this branch
$containers = docker compose -p $envInfo.Project ps -q 2>$null
if (-not $containers) {
  Write-Warning "Warning: no containers running for branch '$($envInfo.Branch)'. Run the compose script first."
  exit 1
}

python Database/import_from_csv.py $flag
