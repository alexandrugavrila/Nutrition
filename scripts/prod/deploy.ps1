<#
.SYNOPSIS
    Deploy a specific production application tag through the production compose stack.

.PARAMETER Tag
    The immutable application tag to apply to BACKEND_IMAGE and FRONTEND_IMAGE
    in .env.production before pulling, migrating, and refreshing the stack.
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0, Mandatory = $true)]
  [string]$Tag
)

$ErrorActionPreference = 'Stop'

. "$PSScriptRoot/../lib/prod-compose.ps1"

$repoRoot = Get-ProdRepoRoot
Set-Location $repoRoot

$snapshot = Invoke-ProdBackup -Label "predeploy-$Tag"
Write-Host "Pre-deploy snapshot: $($snapshot.DumpPath)"
Write-Host "Snapshot metadata:   $($snapshot.MetadataPath)"

$currentBackendImage = Get-ProdEnvValue -Key 'BACKEND_IMAGE'
$currentFrontendImage = Get-ProdEnvValue -Key 'FRONTEND_IMAGE'
$newBackendImage = Set-ProdImageTag -Image $currentBackendImage -Tag $Tag
$newFrontendImage = Set-ProdImageTag -Image $currentFrontendImage -Tag $Tag

Write-Host "Updating production image references in .env.production..."
Write-Host "  BACKEND_IMAGE: $currentBackendImage -> $newBackendImage"
Write-Host "  FRONTEND_IMAGE: $currentFrontendImage -> $newFrontendImage"
Set-ProdEnvValue -Key 'BACKEND_IMAGE' -Value $newBackendImage
Set-ProdEnvValue -Key 'FRONTEND_IMAGE' -Value $newFrontendImage

Write-Host "Pulling production images..."
Invoke-ProdCompose -Arguments @('pull', 'db', 'backend', 'frontend', 'edge')

Write-Host "Ensuring the production database service is running..."
Invoke-ProdCompose -Arguments @('up', '-d', 'db')
Wait-ProdService -Service 'db' -TimeoutSeconds 180

Invoke-ProdMigration

Write-Host "Refreshing the production stack..."
Invoke-ProdCompose -Arguments @('up', '-d', '--force-recreate', '--remove-orphans')

Write-Host "Waiting for production services to report healthy..."
Wait-ProdStackReady

Write-Host "Production service status:"
Invoke-ProdCompose -Arguments @('ps')

Write-Host "Deployment complete."
