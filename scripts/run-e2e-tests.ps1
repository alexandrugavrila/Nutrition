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
  Write-Host "  - If BACKEND_PORT is unset or backend is unreachable, starts the stack via" \
             "./scripts/compose.ps1 up -test"
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

$startedStack = $false

if (-not $env:BACKEND_PORT -or -not (Test-BackendHealthy -Port $env:BACKEND_PORT)) {
  # Bring up the stack; this sets BACKEND_PORT in the current session
  & "$PSScriptRoot/compose.ps1" up -test
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  $startedStack = $true
}

Write-Host "Checking backend health on port $env:BACKEND_PORT..."
$deadline = (Get-Date).AddSeconds(120)
while (-not (Test-BackendHealthy -Port $env:BACKEND_PORT)) {
  if ((Get-Date) -ge $deadline) {
    Write-Error "Backend did not become healthy on port $env:BACKEND_PORT within timeout."
    exit 1
  }
  Start-Sleep -Seconds 1
}

Write-Host "Running e2e tests against http://localhost:$env:BACKEND_PORT/api"
& pytest -vv -rP -s -m e2e Backend/tests/test_e2e_api.py @PytestArgs
exit $LASTEXITCODE
