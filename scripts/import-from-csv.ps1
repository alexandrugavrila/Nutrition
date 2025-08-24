# scripts/import-from-csv.ps1
[CmdletBinding()]
param(
  [switch]$production,
  [switch]$test
)

function Show-Usage {
  Write-Host "Usage: pwsh ./scripts/import-from-csv.ps1 -production|-test" -ForegroundColor Yellow
}

if (([int]$production + [int]$test) -ne 1) {
  Show-Usage
  exit 1
}

$flag = if ($production) { "--production" } else { "--test" }

# Determine repo root
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Determine branch-specific project name
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$sanitized = ($branch.ToLower() -replace '[^a-z0-9]', '-').Trim('-')
$project = "nutrition-$sanitized"

# Ensure containers are running for this branch
$containers = docker compose -p $project ps -q 2>$null
if (-not $containers) {
  Write-Warning "Warning: no containers running for branch '$branch'. Run the compose script first."
  exit 1
}

# Get mapped database port
$portLine = docker compose -p $project port db 5432 2>$null
if (-not $portLine) {
  Write-Warning "Warning: unable to determine database port for project '$project'."
  exit 1
}
$DB_PORT = ($portLine -split ':')[-1]
$env:DB_PORT = $DB_PORT

python Database/import_from_csv.py $flag
