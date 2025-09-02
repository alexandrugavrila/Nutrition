# scripts/db/backup.ps1
[CmdletBinding()]
param()

. "$PSScriptRoot/../lib/branch-env.ps1"
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

$containers = docker compose -p $envInfo.Project ps -q 2>$null
if (-not $containers) {
  Write-Warning "Warning: no containers running for branch '$($envInfo.Branch)'. Run the compose script first."
  exit 1
}

$backupDir = Join-Path $envInfo.RepoRoot "Database/backups"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpPath = Join-Path $backupDir "$($envInfo.Sanitized)-$timestamp.dump"
pg_dump --format=custom --no-owner --no-privileges --file="$dumpPath" $env:DATABASE_URL
Write-Host "Wrote backup to $dumpPath"
