# scripts/compose-restart-branch.ps1
[CmdletBinding()]
param(
  [switch]$production,
  [switch]$test,
  [switch]$empty,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Services
)

. "$PSScriptRoot/lib/branch-env.ps1"
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

Write-Host "Bringing down containers for '$($envInfo.Branch)'..."
docker compose -p $envInfo.Project down -v --remove-orphans | Out-Null
docker network rm "${($envInfo.Project)}_default" 2>$null | Out-Null
docker volume rm "${($envInfo.Project)}_node_modules" 2>$null | Out-Null

Write-Host "Bringing up containers..."
& "$PSScriptRoot/compose-up-branch.ps1" @PSBoundParameters
