# Runs end-to-end API tests. If the branch-specific stack is not up/healthy,
# spins it up in -test mode and waits for the backend to be reachable.
[CmdletBinding()]
param(
  # Additional arguments passed to pytest
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PytestArgs
)

$ErrorActionPreference = 'Stop'

function Show-Usage {
  Write-Host ""
  Write-Host "Usage:" -ForegroundColor Yellow
  Write-Host "  pwsh ./scripts/run-e2e-tests.ps1  [pytest-args...]"
  Write-Host ""
  Write-Host "Behavior:" -ForegroundColor Yellow
  Write-Host "  - Uses docker compose to determine the backend port for the current branch"
  Write-Host "  - If the backend is unreachable, starts the stack via ./scripts/compose.ps1 up -test" \
             "and reads port information from the generated env file"
  Write-Host "  - Waits for the backend to become healthy"
  Write-Host "  - Runs: pytest -vv -rP -s -m e2e Backend/tests/test_e2e_api.py [pytest-args]"
  Write-Host ""
  Write-Host "Examples:" -ForegroundColor Yellow
  Write-Host "  pwsh ./scripts/run-e2e-tests.ps1 -q"
  Write-Host "  pwsh ./scripts/run-e2e-tests.ps1 -k ingredient"
  Write-Host ""
}

if ($PSBoundParameters.ContainsKey('help') -or $args -contains '-h' -or $args -contains '--help') {
  Show-Usage
  exit 0
}

$repoRoot = Resolve-Path "$PSScriptRoot/.."
Set-Location $repoRoot

# Ensure virtual environment is active
$activationLog = [System.IO.Path]::GetTempFileName()
if (-not $env:VIRTUAL_ENV) {
  Write-Host "No virtualenv detected; activating via ./scripts/activate-venv.ps1 ..."
  & "$PSScriptRoot/activate-venv.ps1" *> $activationLog 2>&1
  if ($LASTEXITCODE -ne 0) {
    Get-Content $activationLog
    Remove-Item $activationLog -ErrorAction SilentlyContinue
    Write-Error "Failed to activate virtual environment"
    exit 1
  }
}
Remove-Item $activationLog -ErrorAction SilentlyContinue

function Test-BackendHealthy([int]$Port) {
  try {
    # Use a lightweight endpoint; follow redirects if needed by calling ingredients without trailing slash
    $uri = "http://localhost:$Port/api/ingredients"
    $resp = Invoke-WebRequest -Uri $uri -Method GET -TimeoutSec 2 -MaximumRedirection 2 -ErrorAction Stop
    return $true
  }
  catch {
    return $false
  }
}

# Determine compose project for this branch
$branch = (git rev-parse --abbrev-ref HEAD).Trim()
$sanitized = ($branch.ToLower() -replace '[^a-z0-9]', '-').Trim('-')
$project = "nutrition-$sanitized"

function Get-BackendPort($proj) {
  try {
    $res = docker compose -p $proj port backend 8000 2>$null
    if ($LASTEXITCODE -eq 0 -and $res) { return ($res -split ':')[-1] }
  } catch { }
  return $null
}

$backendPort = Get-BackendPort $project
if (-not $backendPort -or -not (Test-BackendHealthy -Port $backendPort)) {
  $envFile = [System.IO.Path]::GetTempFileName()
  try {
    $env:COMPOSE_ENV_FILE = $envFile
    & "$PSScriptRoot/compose.ps1" up -test
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    Get-Content $envFile | ForEach-Object {
      if ($_ -match '^([^=]+)=(.+)$') { Set-Item -Path "env:$($matches[1])" -Value $matches[2] }
    }
    $backendPort = $env:BACKEND_PORT
  } finally {
    Remove-Item $envFile -ErrorAction SilentlyContinue
    Remove-Item env:COMPOSE_ENV_FILE -ErrorAction SilentlyContinue
  }
}
$env:BACKEND_PORT = $backendPort

Write-Host "Checking backend health on port $backendPort..."
$deadline = (Get-Date).AddSeconds(120)
while (-not (Test-BackendHealthy -Port $backendPort)) {
  if ((Get-Date) -ge $deadline) {
    Write-Error "Backend did not become healthy on port $backendPort within timeout."
    exit 1
  }
  Start-Sleep -Seconds 1
}

Write-Host "Running e2e tests against http://localhost:$backendPort/api"
& pytest -vv -rP -s -m e2e Backend/tests/test_e2e_api.py @PytestArgs
exit $LASTEXITCODE
