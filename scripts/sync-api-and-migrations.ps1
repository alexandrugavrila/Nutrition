# scripts/sync-api-and-migrations.ps1
# Orchestrates:
#   1) Update OpenAPI schema + frontend TS types (via update-api-schema.ps1)
#   2) Ensure Alembic migrations reflect models (via check-migration-drift.ps1)
#
# Exit codes mirror check-migration-drift.ps1:
#   0 = Up to date (already clean or clean after adoption)
#   1 = Script/tooling error
#   2 = Continued drift after adoption (investigate)

[CmdletBinding()]
param(
    [Alias("y")]
    [switch]$Auto
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# --- Helpers -----------------------------------------------------------------
function Ensure-Venv {
    # We activate only to ensure Python/uvicorn for update-api-schema.ps1.
    # The drift script activates Alembic itself.
    $activationLog = [System.IO.Path]::GetTempFileName()
    $needActivate = (-not $env:VIRTUAL_ENV)
    if ($needActivate) {
        if (Test-Path "$PSScriptRoot/activate-venv.ps1") {
            & "$PSScriptRoot/activate-venv.ps1" *> $activationLog 2>&1
            if ($LASTEXITCODE -ne 0) {
                Get-Content $activationLog | Write-Host
                Remove-Item $activationLog -ErrorAction SilentlyContinue
                throw "Failed to activate virtual environment"
            }
        }
    }
    Remove-Item $activationLog -ErrorAction SilentlyContinue
}

function Get-RepoRoot {
    Split-Path -Parent $PSScriptRoot
}

function Test-GitPresent {
    return [bool](Get-Command git -ErrorAction SilentlyContinue)
}

# --- Main --------------------------------------------------------------------
$repoRoot = Get-RepoRoot
Set-Location $repoRoot

# Auto/CI mode flag
$autoMode = $Auto.IsPresent -or ($env:CI -eq "true")

# 1) Ensure Python/uvicorn available (venv) for update-api-schema
Ensure-Venv

# 2) Update OpenAPI schema + frontend types
$updateLog = [System.IO.Path]::GetTempFileName()
try {
    & "$PSScriptRoot/update-api-schema.ps1" *> $updateLog 2>&1
    if ($LASTEXITCODE -ne 0) {
        Get-Content $updateLog | Write-Host
        throw "Failed to update OpenAPI schema / frontend types"
    }
} finally {
    Remove-Item $updateLog -ErrorAction SilentlyContinue
}

# 3) Optionally revert API-file changes if not in auto mode
$apiPaths = @("Backend/openapi.json", "Frontend/src/api-types.ts") | Where-Object { Test-Path $_ }
if ($apiPaths.Count -gt 0 -and (Test-GitPresent)) {
    $apiDiff = $false
    git diff --quiet -- @apiPaths
    $apiDiff = ($LASTEXITCODE -ne 0)

    if ($apiDiff) {
        Write-Host "OpenAPI schema or frontend types changed."
        if ($autoMode) {
            Write-Host "Auto mode: keeping generated API files."
        } else {
            $resp = Read-Host "Keep generated API files? [y/N]"
            if ($resp -notmatch '^[Yy]$') {
                git checkout -- @apiPaths | Out-Null
                Write-Host "Reverted API changes."
            } else {
                Write-Host "Kept generated API changes. (Tip: run `git diff -- Backend/openapi.json Frontend/src/api-types.ts` to review.)"
            }
        }
    } else {
        Write-Host "OpenAPI schema and frontend types are up to date."
    }
} else {
    Write-Host "Note: git not found or API paths missing; skipping diff/revert step."
}

# 4) Run drift detection/adoption (delegated)
#    This script:
#      - spins up a temp Postgres (docker run)
#      - applies existing migrations
#      - autogenerates a temp revision
#      - adopts it if drift is found
#      - verifies a second autogen is clean
#      - returns 0/1/2 accordingly
& "$PSScriptRoot/check-migration-drift.ps1"
$driftExit = $LASTEXITCODE

switch ($driftExit) {
    0 {
        # Up to date (already or after adoption)
        exit 0
    }
    2 {
        # Continued drift after adoption – bubble up with guidance
        Write-Warning "Drift remains after adoption. Investigate autogenerate config or model/env settings."
        exit 2
    }
    default {
        # Error path
        Write-Error "check-migration-drift.ps1 failed (exit $driftExit)."
        exit 1
    }
}
