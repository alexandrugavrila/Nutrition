# scripts/import-from-csv.ps1
[CmdletBinding()]
param(
  [switch]$production,
  [switch]$test
)

function Show-Usage {
  Write-Host "Usage: pwsh ./scripts/db/import-from-csv.ps1 -production|-test" -ForegroundColor Yellow
}

if (([int]$production + [int]$test) -ne 1) {
  Show-Usage
  exit 1
}

$flag = if ($production) { "--production" } else { "--test" }

. "$PSScriptRoot/../lib/branch-env.ps1"
. "$PSScriptRoot/../lib/venv.ps1"
. "$PSScriptRoot/../lib/compose-utils.ps1"
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

# Ensure virtual environment is active
Ensure-Venv

# Ensure containers are running for this branch
Ensure-BranchContainers | Out-Null

python Database/import_from_csv.py $flag
