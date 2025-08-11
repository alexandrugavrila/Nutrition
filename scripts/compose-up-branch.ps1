# scripts/compose-up-branch.ps1
[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$Services
)

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$sanitized = ($branch.ToLower() -replace '[^a-z0-9]', '-').Trim('-')

$offset = [math]::Abs($branch.GetHashCode()) % 100
$env:DB_PORT = 5432 + $offset
$env:BACKEND_PORT = 5000 + $offset
$env:FRONTEND_PORT = 3000 + $offset

Write-Host "Starting '$branch' with ports:`n  DB: $env:DB_PORT`n  Backend: $env:BACKEND_PORT`n  Frontend: $env:FRONTEND_PORT"

docker compose -p "nutrition-$sanitized" up -d @Services
