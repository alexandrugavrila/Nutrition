<#
  scripts/db/backup.ps1
  Creates a timestamped PostgreSQL dump for the branch-local database.
  Falls back to running pg_dump inside the db container if client tools are not on PATH.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

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

# Prefer host pg_dump if available; otherwise exec inside the db container.
$usedContainerDump = $false
if (Get-Command pg_dump -ErrorAction SilentlyContinue) {
  & pg_dump --format=custom --no-owner --no-privileges --file="$dumpPath" $env:DATABASE_URL
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
} else {
  $usedContainerDump = $true
  # Use known compose credentials from docker-compose.yml
  $project = $envInfo.Project
  # Run pg_dump inside the db container. Set PGPASSWORD to avoid prompts.
  docker compose -p $project exec -T -e PGPASSWORD=nutrition_pass db `
    pg_dump --format=custom --no-owner --no-privileges -h localhost -U nutrition_user -d nutrition -f "/tmp/backup.dump"
  if ($LASTEXITCODE -ne 0) { throw "container pg_dump failed with exit code $LASTEXITCODE" }
  # Copy the dump out of the container to the host path.
  $containerName = (docker compose -p $project ps -q db)
  if (-not $containerName) { throw "Could not resolve db container id for project '$project'" }
  docker cp "$containerName`:/tmp/backup.dump" "$dumpPath"
  if ($LASTEXITCODE -ne 0) { throw "docker cp failed with exit code $LASTEXITCODE" }
  # Clean up the temp file in the container (best effort)
  docker compose -p $project exec -T db sh -lc 'rm -f /tmp/backup.dump' 2>$null | Out-Null
}

Write-Host "Wrote backup to $dumpPath"

# Capture Alembic version and git commit for traceability
$alembicVersion = $null
try {
  if (Get-Command psql -ErrorAction SilentlyContinue) {
    $alembicVersion = (& psql $env:DATABASE_URL -Atc "SELECT version_num FROM alembic_version LIMIT 1;" 2>$null)
  } else {
    # Query inside the container using service-local connection
    $project = $envInfo.Project
    $alembicVersion = (docker compose -p $project exec -T -e PGPASSWORD=nutrition_pass db `
      psql -h localhost -U nutrition_user -d nutrition -Atc "SELECT version_num FROM alembic_version LIMIT 1;" 2>$null)
  }
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
