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
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

# Ensure virtual environment is active
$activationLog = [System.IO.Path]::GetTempFileName()
if (-not $env:VIRTUAL_ENV) {
  Write-Host "No virtualenv detected; activating via ./scripts/env/activate-venv.ps1 ..."
  & "$PSScriptRoot/../env/activate-venv.ps1" *> $activationLog 2>&1
  if ($LASTEXITCODE -ne 0) {
    Get-Content $activationLog
    Remove-Item $activationLog -ErrorAction SilentlyContinue
    Write-Error "Failed to activate virtual environment"
    exit 1
  }
}
Remove-Item $activationLog -ErrorAction SilentlyContinue

# Ensure containers are running for this branch
$containers = docker compose -p $envInfo.Project ps -q 2>$null
if (-not $containers) {
  Write-Warning "Warning: no containers running for branch '$($envInfo.Branch)'. Run the compose script first."
  exit 1
}

python Database/import_from_csv.py $flag
