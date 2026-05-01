<#
  scripts/auth/create-admin.ps1
  Creates an admin account against the running branch-local database.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Email,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [Parameter(Mandatory = $true)]
  [string]$DisplayName
)

$ErrorActionPreference = 'Stop'

. "$PSScriptRoot/../lib/branch-env.ps1"
. "$PSScriptRoot/../lib/compose-utils.ps1"
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

Ensure-BranchContainers | Out-Null

& "$PSScriptRoot/../env/activate-venv.ps1"

$python = Join-Path $envInfo.RepoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  throw "Python executable not found at '$python'."
}

$scriptPath = Join-Path $envInfo.RepoRoot "scripts\auth\create-admin.py"
if (-not (Test-Path $scriptPath)) {
  throw "Admin creation script not found at '$scriptPath'."
}

$env:DATABASE_URL = "postgresql://nutrition_user:nutrition_pass@localhost:$($env:DEV_DB_PORT)/nutrition"

& $python $scriptPath `
  --email $Email `
  --password $Password `
  --display-name $DisplayName

if ($LASTEXITCODE -ne 0) {
  throw "Admin creation failed with exit code $LASTEXITCODE."
}
