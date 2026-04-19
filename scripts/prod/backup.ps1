<#
.SYNOPSIS
    Create a production database snapshot for the production compose stack.

.PARAMETER Label
    Optional label included in the snapshot filename for traceability.
#>
[CmdletBinding()]
param(
  [string]$Label = 'manual'
)

$ErrorActionPreference = 'Stop'

. "$PSScriptRoot/../lib/prod-compose.ps1"

$repoRoot = Get-ProdRepoRoot
Set-Location $repoRoot

$snapshot = Invoke-ProdBackup -Label $Label
Write-Host "Snapshot dump:     $($snapshot.DumpPath)"
Write-Host "Snapshot metadata: $($snapshot.MetadataPath)"
