# scripts/compose-up-branch.ps1
[CmdletBinding(DefaultParameterSetName='Empty')]
param(
  [Parameter(ParameterSetName='Production', Mandatory=$true)]
  [switch]$production,

  [Parameter(ParameterSetName='Test', Mandatory=$true)]
  [switch]$test,

  [Parameter(ParameterSetName='Empty', Mandatory=$true)]
  [switch]$empty,

  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$Services
)

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$sanitized = ($branch.ToLower() -replace '[^a-z0-9]', '-').Trim('-')
$project = "nutrition-$sanitized"

$offset = [math]::Abs($branch.GetHashCode()) % 100
$env:DB_PORT = 5432 + $offset
$env:BACKEND_PORT = 5000 + $offset
$env:FRONTEND_PORT = 3000 + $offset

Write-Host "Starting '$branch' with ports:`n  DB: $env:DB_PORT`n  Backend: $env:BACKEND_PORT`n  Frontend: $env:FRONTEND_PORT"

docker compose -p $project up -d @Services

if (-not $empty) {
  Write-Host "Waiting for database to be ready..."
  do {
    Start-Sleep -Seconds 1
    docker compose -p $project exec -T db pg_isready -U nutrition_user -d nutrition | Out-Null
  } until ($LASTEXITCODE -eq 0)

  if ($production) {
    Write-Host "Importing production data..."
    python Database/import_from_csv.py --production
  } elseif ($test) {
    Write-Host "Importing test data..."
    python Database/import_from_csv.py --test
  }
} else {
  Write-Host "Starting with empty database."
}
