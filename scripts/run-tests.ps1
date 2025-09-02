#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Run backend and frontend tests, optionally including end-to-end tests.

.PARAMETER e2e
    Also run end-to-end API tests via scripts/tests/run-e2e-tests.ps1
.PARAMETER sync
    Run model/API sync (OpenAPI schema + frontend TS types + migration drift) before tests.
.PARAMETER full
    Equivalent to -sync and -e2e; runs sync then all tests including e2e.
#>
[CmdletBinding()]
param(
    [switch]$e2e,
    [switch]$sync,
    [switch]$full
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path "$PSScriptRoot/.."
Set-Location $RepoRoot

# Resolve composite flags
if ($full) {
    $sync = $true
    $e2e  = $true
}

# Optional: synchronize OpenAPI + migrations (non-interactive)
if ($sync) {
    Write-Host "Synchronizing API schema and database migrations..."
    & "$RepoRoot/scripts/db/sync-api-and-migrations.ps1" -Auto
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# Ensure virtual environment is active (activate only if not already)
if (-not $env:VIRTUAL_ENV) {
    Write-Host "No virtualenv detected; activating via ./scripts/env/activate-venv.ps1 ..."
    try {
        . "$RepoRoot/scripts/env/activate-venv.ps1"
    }
    catch {
        Write-Error "Failed to activate virtual environment: $($_.Exception.Message)"
        exit 1
    }
    # Clear any lingering native process exit code from activation steps
    if ($LASTEXITCODE -ne 0) { $global:LASTEXITCODE = 0 }
} else {
    Write-Host "Using existing virtualenv: $env:VIRTUAL_ENV"
}

# Backend tests (exclude e2e by default; use -e2e to include)
# Force an isolated test database so unit tests never touch the dev DB.
$prevDbUrl = $env:DATABASE_URL
$env:DATABASE_URL = 'sqlite://'
pytest -m "not e2e"
$pyExit = $LASTEXITCODE
if ($null -eq $prevDbUrl) { Remove-Item Env:DATABASE_URL -ErrorAction Ignore } else { $env:DATABASE_URL = $prevDbUrl }
if ($pyExit -ne 0) { exit $pyExit }

# Frontend tests
$prevCI = $env:CI
$env:CI = 'true'
npm --prefix Frontend test
$npmExit = $LASTEXITCODE
if ($null -eq $prevCI) { Remove-Item Env:CI -ErrorAction Ignore } else { $env:CI = $prevCI }
if ($npmExit -ne 0) { exit $npmExit }

# Optional end-to-end tests
if ($e2e) {
    & "$RepoRoot/scripts/tests/run-e2e-tests.ps1"
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
