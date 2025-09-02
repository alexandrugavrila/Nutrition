# scripts/db/restore.ps1
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$DumpPath,
  [switch]$UpgradeAfter,
  [switch]$FailOnMismatch
)

if (-not (Test-Path $DumpPath)) {
  Write-Error "Dump file '$DumpPath' not found"
  exit 1
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

pg_restore --clean --if-exists --no-owner --no-privileges --dbname=$env:DATABASE_URL $DumpPath

if ($UpgradeAfter) {
  if (Get-Command alembic -ErrorAction SilentlyContinue) {
    Write-Host "Running 'alembic -c Backend/alembic.ini upgrade head' after restore..."
    alembic -c Backend/alembic.ini upgrade head
  } else {
    Write-Warning "Alembic not found on PATH; skipping upgrade. Install backend deps to enable this."
  }
}

