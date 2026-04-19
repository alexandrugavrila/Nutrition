<#
.SYNOPSIS
    Roll back the production application images, with optional database restore.

.DESCRIPTION
    By default this script rolls the backend and frontend images back to a
    specific tag and refreshes the production stack. If -RestoreDatabase is
    supplied, it also restores an explicit production snapshot before the stack
    is brought back up. Database restore is intentionally opt-in because it is
    destructive.

.PARAMETER Tag
    Target application tag for BACKEND_IMAGE and FRONTEND_IMAGE.

.PARAMETER SnapshotPath
    Production snapshot dump path (.dump or .dump.meta.json). If Tag is omitted
    and metadata is present, the recorded BACKEND_IMAGE and FRONTEND_IMAGE
    values are restored exactly.

.PARAMETER RestoreDatabase
    Restore the supplied snapshot into the production database before starting
    the application stack.

.PARAMETER ResetSchema
    Drop and recreate the public schema before restoring the snapshot.
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string]$Tag,

  [string]$SnapshotPath,
  [switch]$RestoreDatabase,
  [switch]$ResetSchema
)

$ErrorActionPreference = 'Stop'

. "$PSScriptRoot/../lib/prod-compose.ps1"

if (-not $Tag -and -not $SnapshotPath) {
  throw "Provide -Tag <tag> or -SnapshotPath <snapshot.dump>."
}

if ($RestoreDatabase -and -not $SnapshotPath) {
  throw "-RestoreDatabase requires -SnapshotPath."
}

$repoRoot = Get-ProdRepoRoot
Set-Location $repoRoot

$currentBackendImage = Get-ProdEnvValue -Key 'BACKEND_IMAGE'
$currentFrontendImage = Get-ProdEnvValue -Key 'FRONTEND_IMAGE'
$resolvedSnapshotPath = $null
$snapshotMetadata = $null

if ($SnapshotPath) {
  $resolvedSnapshotPath = Resolve-ProdDumpPath -Path $SnapshotPath
  $snapshotMetadata = Get-ProdSnapshotMetadata -DumpPath $resolvedSnapshotPath
}

if ($Tag) {
  $targetBackendImage = Set-ProdImageTag -Image $currentBackendImage -Tag $Tag
  $targetFrontendImage = Set-ProdImageTag -Image $currentFrontendImage -Tag $Tag
}
elseif ($snapshotMetadata -and $snapshotMetadata.backend_image -and $snapshotMetadata.frontend_image) {
  $targetBackendImage = [string]$snapshotMetadata.backend_image
  $targetFrontendImage = [string]$snapshotMetadata.frontend_image
}
else {
  throw "Could not determine rollback images from the snapshot metadata. Provide -Tag explicitly."
}

Write-Host "Updating production image references in .env.production..."
Write-Host "  BACKEND_IMAGE: $currentBackendImage -> $targetBackendImage"
Write-Host "  FRONTEND_IMAGE: $currentFrontendImage -> $targetFrontendImage"
Set-ProdEnvValue -Key 'BACKEND_IMAGE' -Value $targetBackendImage
Set-ProdEnvValue -Key 'FRONTEND_IMAGE' -Value $targetFrontendImage

Write-Host "Pulling rollback target images..."
Invoke-ProdCompose -Arguments @('pull', 'db', 'backend', 'frontend', 'edge')

if ($RestoreDatabase) {
  Write-Host "Stopping application services before database restore..."
  Invoke-ProdCompose -Arguments @('up', '-d', 'db')
  Wait-ProdService -Service 'db' -TimeoutSeconds 180
  Invoke-ProdCompose -Arguments @('stop', 'edge', 'frontend', 'backend')
  Invoke-ProdRestore -DumpPath $resolvedSnapshotPath -ResetSchema:$ResetSchema
}

Write-Host "Refreshing the production stack..."
Invoke-ProdCompose -Arguments @('up', '-d', '--force-recreate', '--remove-orphans')

Write-Host "Waiting for production services to report healthy..."
Wait-ProdStackReady

Write-Host "Production service status:"
Invoke-ProdCompose -Arguments @('ps')

Write-Host "Rollback complete."
