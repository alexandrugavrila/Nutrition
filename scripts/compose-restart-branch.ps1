# scripts/compose-restart-branch.ps1
[CmdletBinding()]
param(
  [switch]$production,
  [switch]$test,
  [switch]$empty,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Services
)

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$branch    = (git rev-parse --abbrev-ref HEAD).Trim()
$sanitized = ($branch.ToLower() -replace '[^a-z0-9]', '-').Trim('-')
$project   = "nutrition-$sanitized"

Write-Host "Bringing down containers for '$branch'..."
docker compose -p $project down -v --remove-orphans | Out-Null
docker network rm "${project}_default" 2>$null | Out-Null
docker volume rm "${project}_node_modules" 2>$null | Out-Null

Write-Host "Bringing up containers..."
& "$PSScriptRoot/compose-up-branch.ps1" @PSBoundParameters
