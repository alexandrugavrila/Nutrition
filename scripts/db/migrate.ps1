<#
  scripts/db/migrate.ps1
  Applies Alembic migrations against the running branch-local database.
#>
[CmdletBinding()]
param(
  [switch]$AllowNonLocalDb
)

$ErrorActionPreference = 'Stop'

. "$PSScriptRoot/../lib/branch-env.ps1"
. "$PSScriptRoot/../lib/compose-utils.ps1"
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

Ensure-BranchContainers | Out-Null

if ($env:DATABASE_URL -notmatch 'localhost' -and -not $AllowNonLocalDb) {
  throw "Refusing to migrate non-local database without -AllowNonLocalDb."
}

Write-Host "Waiting for backend dependencies (alembic) to be ready..."
$project = $envInfo.Project
$deadline = (Get-Date).AddMinutes(3)
do {
  Start-Sleep -Seconds 1
  docker compose -p $project exec -T backend sh -lc "python -m pip show alembic >/dev/null 2>&1"
} until ($LASTEXITCODE -eq 0 -or (Get-Date) -ge $deadline)
if ($LASTEXITCODE -ne 0) {
  throw "Backend did not finish installing dependencies (alembic not available) within timeout."
}

Write-Host "Applying database migrations..."
docker compose -p $project exec -T backend sh -lc "cd /app/Backend && python -m alembic -c alembic.ini upgrade head"
if ($LASTEXITCODE -ne 0) {
  throw "Database migration failed with exit code $LASTEXITCODE."
}

Write-Host "Migrations complete."
