# scripts/db/sync-api-and-migrations.ps1
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

# --------------------------- Shared Logging Helpers ---------------------------
function Out-Step   { param([string]$m) Write-Host "» $m" -ForegroundColor Cyan }
function Out-Info   { param([string]$m) Write-Host "$m" }
function Out-Ok     { param([string]$m) Write-Host "$m" -ForegroundColor Green }
function Out-Warn   { param([string]$m) Write-Warning $m }
function Out-Err    { param([string]$m) Write-Error $m }
function Out-Result { param([string]$m,[string]$color) Write-Host "[RESULT] $m" -ForegroundColor $color }

# --------------------------- Helpers -----------------------------------------
function Ensure-Venv {
    # We activate only to ensure Python/uvicorn for update-api-schema.ps1.
    # The drift script activates Alembic itself.
    $activationLog = [System.IO.Path]::GetTempFileName()
    $needActivate = (-not $env:VIRTUAL_ENV)
    if ($needActivate) {
        Out-Step "Activating virtual environment..."
        if (Test-Path "$PSScriptRoot/../env/activate-venv.ps1") {
            & "$PSScriptRoot/../env/activate-venv.ps1" *> $activationLog 2>&1
            if ($LASTEXITCODE -ne 0) {
                Get-Content $activationLog
                Remove-Item $activationLog -ErrorAction SilentlyContinue
                throw "Failed to activate virtual environment"
            }
        } else {
            Remove-Item $activationLog -ErrorAction SilentlyContinue
            throw "activate-venv.ps1 was not found in scripts/env"
        }
    }
    Remove-Item $activationLog -ErrorAction SilentlyContinue
}

function Get-RepoRoot { Split-Path -Parent (Split-Path -Parent $PSScriptRoot) }
function Test-GitPresent { return [bool](Get-Command git -ErrorAction SilentlyContinue) }

# --------------------------- Setup -------------------------------------------
$repoRoot = Get-RepoRoot
Set-Location $repoRoot

# Auto/CI mode flag
$autoMode = $Auto.IsPresent -or ($env:CI -eq "true")

# Track summary details
$apiStatus        = "unchanged"   # or "updated" / "skipped"
$migrationStatus  = "clean"       # or "adopted" / "unknown"
$fatalError       = $null

# --------------------------- 1) Ensure venv ----------------------------------
try {
    Ensure-Venv
    Out-Ok "Virtual environment is active."
}
catch {
    $fatalError = $_
    Out-Err "Script failed: $fatalError"
    Out-Result "Script error" "Red"
    exit 1
}

# --------------------------- 2) Update API schema/types ----------------------
$updateLog = [System.IO.Path]::GetTempFileName()
try {
    Out-Step "Updating OpenAPI schema and frontend types..."
    & "$PSScriptRoot/update-api-schema.ps1" *> $updateLog 2>&1
    if ($LASTEXITCODE -ne 0) {
        Get-Content $updateLog | ForEach-Object { Out-Info $_ }
        throw "Failed to update OpenAPI schema / frontend types"
    }
    Out-Ok "OpenAPI schema and types updated (or already current)."

    # Decide whether files actually changed and optionally revert
    $apiPaths = @("Backend/openapi.json", "Frontend/src/api-types.ts") | Where-Object { Test-Path $_ }
    if ($apiPaths.Count -gt 0 -and (Test-GitPresent)) {
        git diff --quiet -- @apiPaths
        $apiChanged = ($LASTEXITCODE -ne 0)
        if ($apiChanged) {
            $apiStatus = "updated"
            Out-Info "OpenAPI schema or frontend types changed."
            if ($autoMode) {
                Out-Info "Auto mode: keeping generated API files."
            } else {
                $resp = Read-Host "Keep generated API files? [y/N]"
                if ($resp -notmatch '^[Yy]$') {
                    git checkout -- @apiPaths | Out-Null
                    Out-Info "Reverted API changes."
                    $apiStatus = "unchanged"
                } else {
                    Out-Info "Kept generated API changes. (Tip: run `git diff -- Backend/openapi.json Frontend/src/api-types.ts` to review.)"
                }
            }
        } else {
            Out-Info "OpenAPI schema and frontend types are up to date."
        }
    } else {
        Out-Info "Note: git not found or API paths missing; skipping diff/revert step."
        $apiStatus = "skipped"
    }
}
catch {
    $fatalError = $_
}
finally {
    Remove-Item $updateLog -ErrorAction SilentlyContinue
}

if ($fatalError) {
    Out-Err "Script failed during API update: $fatalError"
    Out-Result "Script error" "Red"
    exit 1
}

# --------------------------- 3) Run drift detection/adoption -----------------
# To distinguish "clean" vs "adopted" when exit code is 0, we snapshot migration files before/after.
$migrationsDir = Join-Path $repoRoot "Backend/migrations/versions"
$beforeList = @()
$afterList  = @()
$usedGit    = Test-GitPresent

if (Test-Path $migrationsDir) {
    $beforeList = Get-ChildItem -Path $migrationsDir -Filter "*.py" -File | Select-Object -ExpandProperty FullName
}

Out-Step "Checking for migration drift (and adopting if present)..."
& "$PSScriptRoot/check-migration-drift.ps1"
$driftExit = $LASTEXITCODE

if (Test-Path $migrationsDir) {
    $afterList = Get-ChildItem -Path $migrationsDir -Filter "*.py" -File | Select-Object -ExpandProperty FullName
}

# Infer whether a migration was adopted (exit=0 covers both cases)
if ($driftExit -eq 0) {
    if ($usedGit) {
        # If git is available, check diff status of migrations directory
        git diff --quiet -- Backend/migrations/versions
        $migrationsChanged = ($LASTEXITCODE -ne 0)
        $migrationStatus = $migrationsChanged ? "adopted" : "clean"
    } else {
        # Fallback heuristic: file count changed
        $migrationStatus = ($afterList.Count -gt $beforeList.Count) ? "adopted" : "clean"
    }
}

# --------------------------- 4) Final Summary & Exit -------------------------
switch ($driftExit) {
    0 {
        # Up to date (already or after adoption)
        $apiMsg = switch ($apiStatus) {
            "updated"   { "API types UPDATED" }
            "unchanged" { "API types unchanged" }
            default     { "API types step skipped" }
        }
        $migMsg = switch ($migrationStatus) {
            "adopted" { "Migrations ADOPTED" }
            "clean"   { "Migrations CLEAN" }
            default   { "Migrations status unknown" }
        }

        Out-Ok "Summary:"
        Out-Ok " - $apiMsg"
        Out-Ok " - $migMsg"
        Out-Result "Up to date (${apiMsg}; ${migMsg})" "Green"
        exit 0
    }
    2 {
        # Continued drift after adoption – bubble up with guidance
        Out-Warn "Drift remains after adoption. Investigate autogenerate config or model/env settings."
        $apiMsg = ($apiStatus -eq "updated") ? "API types UPDATED" : (($apiStatus -eq "unchanged") ? "API types unchanged" : "API types step skipped")
        Out-Info "API step: $apiMsg"
        Out-Result "Continued drift after adoption" "Yellow"
        exit 2
    }
    default {
        # Error path
        Out-Err "check-migration-drift.ps1 failed (exit $driftExit)."
        Out-Result "Script error" "Red"
        exit 1
    }
}
