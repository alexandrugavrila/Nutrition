<#
  scripts/db/restore.ps1
  Restores a PostgreSQL custom-format dump into the branch-local database.
  Falls back to running pg_restore inside the db container if client tools are not on PATH.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$DumpPath,
  [switch]$UpgradeAfter,
  [switch]$FailOnMismatch
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $DumpPath)) {
  Write-Error "Dump file '$DumpPath' not found"
  exit 1
}

# If a .meta.json file was passed by mistake, try the matching .dump file
if ($DumpPath -like '*.meta.json') {
  $suffix = '.meta.json'
  if ($DumpPath.EndsWith($suffix)) {
    $candidate = $DumpPath.Substring(0, $DumpPath.Length - $suffix.Length)
  } else {
    $candidate = $DumpPath
  }
  if (Test-Path $candidate) {
    Write-Host "Detected metadata file; using dump '$candidate' instead."
    $DumpPath = $candidate
  } else {
    Write-Error "'$DumpPath' looks like metadata. Provide the .dump file."
    exit 1
  }
}

. "$PSScriptRoot/../lib/branch-env.ps1"
. "$PSScriptRoot/../lib/compose-utils.ps1"
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

if ($env:DATABASE_URL -notlike "postgresql://*localhost*") {
  Write-Error "Refusing to restore to non-localhost database"
  exit 1
}

# Ensure containers are running for this branch
Ensure-BranchContainers | Out-Null

# Print backup Alembic version and compare with repo head(s) if possible
$backupVersion = 'unknown'
$metaPath = "$DumpPath.meta.json"
if (Test-Path $metaPath) {
  try {
    $meta = Get-Content -Raw -Path $metaPath | ConvertFrom-Json
    if ($meta.alembic_version) { $backupVersion = [string]$meta.alembic_version }
  } catch {}
}

$repoHeads = ''
try {
  $pyLine = "from alembic.config import Config; from alembic.script import ScriptDirectory as S; print(','.join(S.from_config(Config('Backend/alembic.ini')).get_heads()))"
  $repoHeads = (& python -c $pyLine 2>$null)
} catch {}

Write-Host "Backup Alembic revision: $backupVersion"
if ($repoHeads) {
  Write-Host "Repo head(s): $repoHeads"
  if ($backupVersion -and -not ($repoHeads -like "*${backupVersion}*")) {
    Write-Warning "Backup revision differs from repo head(s)."
    if ($FailOnMismatch) { Write-Error "Failing due to -FailOnMismatch"; exit 2 }
  }
}

# Restore using host pg_restore if available, otherwise exec inside the db container
if (Get-Command pg_restore -ErrorAction SilentlyContinue) {
  & pg_restore --clean --if-exists --no-owner --no-privileges --dbname=$env:DATABASE_URL "$DumpPath"
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
} else {
  $project = $envInfo.Project
  $containerId = (docker compose -p $project ps -q db)
  if (-not $containerId) { throw "Could not resolve db container id for project '$project'" }
  # Copy dump into the container and restore there
  docker cp "$DumpPath" "$containerId`:/tmp/restore.dump"
  if ($LASTEXITCODE -ne 0) { throw "docker cp to container failed with exit code $LASTEXITCODE" }
  docker compose -p $project exec -T -e PGPASSWORD=nutrition_pass db `
    pg_restore --clean --if-exists --no-owner --no-privileges -h localhost -U nutrition_user -d nutrition "/tmp/restore.dump"
  if ($LASTEXITCODE -ne 0) { throw "container pg_restore failed with exit code $LASTEXITCODE" }
  # Best-effort cleanup
  docker compose -p $project exec -T db sh -lc 'rm -f /tmp/restore.dump' 2>$null | Out-Null
}

if ($UpgradeAfter) {
  if (Get-Command alembic -ErrorAction SilentlyContinue) {
    Write-Host "Running 'alembic -c Backend/alembic.ini upgrade head' after restore..."
    alembic -c Backend/alembic.ini upgrade head
  } else {
    # Try running inside backend container if available
    $project = $envInfo.Project
    $backendId = (docker compose -p $project ps -q backend)
    if ($backendId) {
      Write-Host "Running Alembic inside backend container..."
      docker compose -p $project exec -T backend alembic -c /app/Backend/alembic.ini upgrade head
    } else {
      Write-Warning "Alembic not found on PATH and backend container not running; skipping upgrade."
    }
  }
}

