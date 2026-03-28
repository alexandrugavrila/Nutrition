# scripts/import-from-csv.ps1
[CmdletBinding()]
param(
  [switch]$production,
  [switch]$test,
  [switch]$AllowProductionSeed,
  [switch]$AllowNonLocalDb
)

function Show-Usage {
  Write-Host "Usage: pwsh ./scripts/db/import-from-csv.ps1 -production|-test [-AllowProductionSeed] [-AllowNonLocalDb]" -ForegroundColor Yellow
}

if (([int]$production + [int]$test) -ne 1) {
  Show-Usage
  exit 1
}

if ($production -and -not $AllowProductionSeed) {
  Write-Error "Refusing production CSV seed without -AllowProductionSeed."
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

if ($env:DATABASE_URL -notmatch 'localhost' -and -not $AllowNonLocalDb) {
  Write-Error "Refusing to target non-local database without -AllowNonLocalDb."
  exit 1
}

python Database/import_from_csv.py $flag
