# scripts/db/restore.ps1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$DumpPath
)

if (-not (Test-Path $DumpPath)) {
  Write-Error "Dump file '$DumpPath' not found"
  exit 1
}

. "$PSScriptRoot/../lib/branch-env.ps1"
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

if ($env:DATABASE_URL -notlike "postgresql://*localhost*") {
  Write-Error "Refusing to restore to non-localhost database"
  exit 1
}

$containers = docker compose -p $envInfo.Project ps -q 2>$null
if (-not $containers) {
  Write-Warning "Warning: no containers running for branch '$($envInfo.Branch)'. Run the compose script first."
  exit 1
}

pg_restore --clean --if-exists --no-owner --no-privileges --dbname=$env:DATABASE_URL $DumpPath
