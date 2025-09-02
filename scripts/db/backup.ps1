# scripts/db/backup.ps1
[CmdletBinding()]
param()

. "$PSScriptRoot/../lib/branch-env.ps1"
. "$PSScriptRoot/../lib/compose-utils.ps1"
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

# Ensure containers are running for this branch
Ensure-BranchContainers | Out-Null

$backupDir = Join-Path $envInfo.RepoRoot "Database/backups"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpPath = Join-Path $backupDir "$($envInfo.Sanitized)-$timestamp.dump"
pg_dump --format=custom --no-owner --no-privileges --file="$dumpPath" $env:DATABASE_URL
Write-Host "Wrote backup to $dumpPath"

# Capture Alembic version and git commit for traceability
$alembicVersion = $null
try {
  $alembicVersion = (& psql $env:DATABASE_URL -Atc "SELECT version_num FROM alembic_version LIMIT 1;" 2>$null)
} catch {}
if (-not $alembicVersion) { $alembicVersion = 'unknown' }

$gitCommit = 'unknown'
try {
  $gitCommit = (& git rev-parse --short HEAD 2>$null)
  if (-not $gitCommit) { $gitCommit = 'unknown' }
} catch {}

$meta = @{ alembic_version = "$alembicVersion"; git_commit = "$gitCommit"; branch = "$($envInfo.Branch)"; timestamp = "$timestamp" }
$metaPath = "$dumpPath.meta.json"
$meta | ConvertTo-Json | Out-File -FilePath $metaPath -Encoding UTF8
Write-Host "Wrote metadata to $metaPath (alembic_version=$alembicVersion)"
