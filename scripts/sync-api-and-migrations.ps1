# scripts/sync-api-and-migrations.ps1
# Synchronize the OpenAPI schema and database migrations with the current models.
#
# The script first regenerates the OpenAPI schema and frontend TypeScript types
# using scripts/update-api-schema.sh. If this results in changes, the user is
# prompted whether to keep the updates. In CI or when invoked with -y, the
# updates are kept automatically.
#
# Next, it runs `alembic revision --autogenerate` in check mode to determine if
# model changes require a new migration. If differences are detected, the user is
# asked whether to create a migration. Passing -y (or setting CI=true) will
# automatically create the migration.
#
# This makes the script suitable for interactive use and automation (e.g. GitHub
# Actions). When run in automation, provide `-y` to auto-accept prompts or set the
# CI environment variable to `true`.

[CmdletBinding()]
param(
    [Alias("y")]
    [switch]$Auto
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Determine whether to auto-accept prompts
$autoMode = $Auto.IsPresent -or $env:CI -eq "true"

# Ensure we're running from the repository root
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$activationLog = [System.IO.Path]::GetTempFileName()
if (-not $env:VIRTUAL_ENV -or -not (Get-Command uvicorn -ErrorAction SilentlyContinue)) {
    Write-Host "Activating virtual environment..."
    & "$PSScriptRoot/activate-venv.ps1" *> $activationLog 2>&1
    if ($LASTEXITCODE -ne 0) {
        Get-Content $activationLog
        Remove-Item $activationLog
        Write-Error "Failed to activate virtual environment"
        exit 1
    }
}
Remove-Item $activationLog -ErrorAction SilentlyContinue

if (-not (Get-Command uvicorn -ErrorAction SilentlyContinue)) {
    Write-Error "uvicorn command not found after attempting to activate virtual environment"
    exit 1
}

#############################
# Check OpenAPI / Frontend
#############################

$logFile = [System.IO.Path]::GetTempFileName()
& "$PSScriptRoot/update-api-schema.ps1" *> $logFile 2>&1
if ($LASTEXITCODE -ne 0) {
    Get-Content $logFile
    Write-Error "Failed to update API schema"
    Remove-Item $logFile
    exit 1
}
Remove-Item $logFile

git diff --quiet -- Backend/openapi.json Frontend/src/api-types.ts
$apiDiff = $LASTEXITCODE -ne 0

if ($apiDiff) {
    Write-Host "OpenAPI schema or frontend types are out of date."
    if ($autoMode) {
        Write-Host "Keeping generated API files."
    } else {
        $resp = Read-Host "Keep generated API files? [y/N]"
        if ($resp -notmatch '^[Yy]$') {
            git checkout -- Backend/openapi.json Frontend/src/api-types.ts | Out-Null
            Write-Host "Reverted API changes."
        }
    }
} else {
    Write-Host "OpenAPI schema and frontend types are up to date."
}

#############################
# Check database migrations
#############################

$tmpfile = [System.IO.Path]::GetTempFileName()
alembic revision --autogenerate -m "tmp" --stdout | Out-File -FilePath $tmpfile -Encoding utf8
if ($LASTEXITCODE -ne 0) {
    Remove-Item $tmpfile
    Write-Error "Failed to check for migration changes"
    exit 1
}
$needsMigration = Select-String -Path $tmpfile -Pattern 'op\.' -Quiet
if ($needsMigration) {
    Write-Host "Model changes detected that are not captured in migrations."
    if ($autoMode) {
        $msg = "auto migration"
        alembic revision --autogenerate -m $msg | Out-Null
        Write-Host "Created migration: $msg"
    } else {
        $resp = Read-Host "Generate new migration now? [y/N]"
        if ($resp -match '^[Yy]$') {
            $msg = Read-Host "Migration message"
            alembic revision --autogenerate -m $msg | Out-Null
        } else {
            Write-Host "Skipping migration generation."
        }
    }
} else {
    Write-Host "Database migrations are up to date."
}
Remove-Item $tmpfile
