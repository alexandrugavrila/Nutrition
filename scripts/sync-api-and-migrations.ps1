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

$composeProject = "nutrition-sync"

# Clean up any leftover sync database container from previous runs.
$existing = docker compose -p $composeProject ps -q db 2>$null
if ($LASTEXITCODE -eq 0 -and $existing) {
    Write-Host "Stopping previous sync database container..."
    docker compose -p $composeProject down -v | Out-Null
}

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

# Start a temporary database container so the script can run outside the compose stack.
# The container is removed when the script completes.
$dbStarted = $false
try {
    Write-Host "Starting database container..."
    docker compose -p $composeProject up -d db | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "failed to start database container" }
    $dbStarted = $true

    Write-Host "Waiting for database to be ready..."
    do {
        Start-Sleep -Seconds 1
        docker compose -p $composeProject exec -T db pg_isready -U nutrition_user -d nutrition | Out-Null
    } until ($LASTEXITCODE -eq 0)

    if (-not $env:DATABASE_URL) {
        $env:DATABASE_URL = "postgresql://nutrition_user:nutrition_pass@localhost:5432/nutrition"
    }

    Write-Host "Applying database migrations..."
    alembic upgrade head | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "failed to apply database migrations" }
}
catch {
    Write-Error "$_"
    if ($dbStarted) { docker compose -p $composeProject down -v | Out-Null }
    exit 1
}
finally {
    if ($dbStarted) {
        Register-EngineEvent PowerShell.Exiting -Action { docker compose -p nutrition-sync down -v | Out-Null } | Out-Null
    }
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

# Alembic 1.13+ requires that generated revision files live within one of the
# configured version locations. Creating the temporary directory inside the
# project's migrations path keeps the check compatible across Alembic versions
# while ensuring the directory is cleaned up afterwards.
$migrationRoot = Join-Path $repoRoot "Backend/migrations"
$tmpdir = New-Item -ItemType Directory -Path (Join-Path $migrationRoot ([System.IO.Path]::GetRandomFileName()))
alembic revision --autogenerate -m "tmp" --version-path $tmpdir.FullName | Out-Null
if ($LASTEXITCODE -ne 0) {
    Remove-Item $tmpdir -Recurse -Force
    Write-Error "Failed to check for migration changes"
    exit 1
}
$tmpfile = Get-ChildItem $tmpdir | Select-Object -First 1
$needsMigration = $tmpfile -and (Select-String -Path $tmpfile.FullName -Pattern 'op\.' -Quiet)
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
Remove-Item $tmpdir -Recurse -Force
