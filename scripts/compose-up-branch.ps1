# scripts/compose-up-branch.ps1
[CmdletBinding()]
param(
  [switch]$production,
  [switch]$test,
  [switch]$empty,

  # Optional: specific services to bring up (e.g., "db", "backend")
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Services
)

# --- Helpers ---
function Show-Usage {
  Write-Host ""
  Write-Host "Usage:" -ForegroundColor Yellow
  Write-Host "  pwsh ./scripts/compose-up-branch.ps1  -production|-test|-empty  [service ...]"
  Write-Host ""
  Write-Host "Examples:"
  Write-Host "  pwsh ./scripts/compose-up-branch.ps1 -test"
  Write-Host "  pwsh ./scripts/compose-up-branch.ps1 -empty backend frontend"
  Write-Host ""
}

# Validate exactly one mode switch
$modeCount = @($production, $test, $empty) | Where-Object { $_ } | Measure-Object | Select-Object -ExpandProperty Count
if ($modeCount -ne 1) {
  Write-Error "You must specify exactly one of: -production, -test, or -empty."
  Show-Usage
  exit 1
}

. "$PSScriptRoot/lib/branch-env.ps1"
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

Write-Host "Starting '$($envInfo.Branch)' with ports:`n  DB: $env:DB_PORT`n  Backend: $env:BACKEND_PORT`n  Frontend: $env:FRONTEND_PORT"

# --- Compose up ---
try {
  docker compose -p $envInfo.Project up -d @Services
  if ($LASTEXITCODE -ne 0) { throw "docker compose exited with code $LASTEXITCODE" }
}
catch {
  Write-Error "Failed to start services: $_"
  exit 1
}

if ($empty) {
  Write-Host "Starting with empty database."
  exit 0
}

# --- Wait for Postgres to be healthy (with timeout) ---
Write-Host "Waiting for database to be ready..."
$deadline = (Get-Date).AddMinutes(2)   # 2 minute timeout
do {
  Start-Sleep -Seconds 1
  docker compose -p $envInfo.Project exec -T db pg_isready -U nutrition_user -d nutrition | Out-Null
} until ($LASTEXITCODE -eq 0 -or (Get-Date) -ge $deadline)

if ($LASTEXITCODE -ne 0) {
  Write-Error "Database did not become ready within the timeout."
  exit 1
}

# --- Ensure backend deps are ready (Alembic) ---
Write-Host "Waiting for backend dependencies (alembic) to be ready..."
$deadline = (Get-Date).AddMinutes(3)
do {
  Start-Sleep -Seconds 1
  docker compose -p $envInfo.Project exec -T backend sh -lc "python -m pip show alembic >/dev/null 2>&1"
} until ($LASTEXITCODE -eq 0 -or (Get-Date) -ge $deadline)

if ($LASTEXITCODE -ne 0) {
  Write-Error "Backend did not finish installing dependencies (alembic not available) within timeout."
  exit 1
}

# --- Run database migrations ---
Write-Host "Applying database migrations..."
# Use python -m to avoid PATH issues with console scripts
docker compose -p $envInfo.Project exec -T backend python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
  Write-Error "Database migration failed with exit code $LASTEXITCODE."
  exit $LASTEXITCODE
}

# --- Seed data depending on mode ---
if ($production -or $test) {
  & "$PSScriptRoot/activate-venv.ps1"

  if ($production) {
    Write-Host "Importing production data..."
    & python Database/import_from_csv.py --production
  } else {
    Write-Host "Importing test data..."
    & python Database/import_from_csv.py --test
  }
}

if ($LASTEXITCODE -ne 0) {
  Write-Error "Data import failed with exit code $LASTEXITCODE."
  exit $LASTEXITCODE
}

Write-Host "Done."
