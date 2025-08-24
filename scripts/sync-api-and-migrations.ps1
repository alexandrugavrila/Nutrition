# scripts/sync-api-and-migrations.ps1
# Synchronize the OpenAPI schema and database migrations with the current models.
# Supports interactive and CI modes (-y or CI=true).

[CmdletBinding()]
param(
    [Alias("y")]
    [switch]$Auto
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-FreeTcpPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
    $listener.Start()
    $port = ($listener.LocalEndpoint).Port
    $listener.Stop()
    return $port
}

# Determine whether to auto-accept prompts
$autoMode = $Auto.IsPresent -or $env:CI -eq "true"

# Ensure we're running from the repository root
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Pin the compose file so we always target the correct stack
$composeFile = Join-Path $repoRoot "docker-compose.yml"  # change if your file is named differently
if (-not (Test-Path $composeFile)) {
    throw "Compose file not found at $composeFile"
}

$composeProject = "nutrition-sync"

# Clean up any leftover sync database container from previous runs.
$existing = docker compose -f $composeFile -p $composeProject ps -q db 2>$null
if ($LASTEXITCODE -eq 0 -and $existing) {
    Write-Host "Stopping previous sync database container..."
    docker compose -f $composeFile -p $composeProject down -v | Out-Null
}

# Use a reliable indicator for venv readiness: alembic should exist
$activationLog = [System.IO.Path]::GetTempFileName()
$needActivate = (-not $env:VIRTUAL_ENV) -or (-not (Get-Command alembic -ErrorAction SilentlyContinue))
if ($needActivate) {
    Write-Host "Activating virtual environment..."
    & "$PSScriptRoot/activate-venv.ps1" *> $activationLog 2>&1
    if ($LASTEXITCODE -ne 0) {
        Get-Content $activationLog
        Remove-Item $activationLog -ErrorAction SilentlyContinue
        Write-Error "Failed to activate virtual environment"
        exit 1
    }
}
Remove-Item $activationLog -ErrorAction SilentlyContinue

if (-not (Get-Command alembic -ErrorAction SilentlyContinue)) {
    Write-Error "alembic command not found after attempting to activate virtual environment"
    exit 1
}

# Choose a free host port for Postgres; wire it through compose and DATABASE_URL
if (-not $env:DB_PORT) { $env:DB_PORT = Get-FreeTcpPort }

if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = "postgresql://nutrition_user:nutrition_pass@localhost:$($env:DB_PORT)/nutrition"
}

# Start a temporary database container so the script can run outside the compose stack.
# The container is removed in the finally block below.
$dbStarted = $false
try {
    Write-Host "Starting database container on host port $($env:DB_PORT)..."
    docker compose -f $composeFile -p $composeProject up -d db | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "failed to start database container" }
    $dbStarted = $true

    Write-Host "Waiting for database to be ready (timeout 2 minutes)..."
    $deadline = (Get-Date).AddMinutes(2)
    do {
        Start-Sleep -Seconds 1
        docker compose -f $composeFile -p $composeProject exec -T db pg_isready -U nutrition_user -d nutrition | Out-Null
        if ((Get-Date) -gt $deadline) { throw "Postgres did not become ready in 2 minutes" }
    } until ($LASTEXITCODE -eq 0)

    Write-Host "Applying database migrations..."
    alembic upgrade head | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "failed to apply database migrations" }

    #############################
    # Check OpenAPI / Frontend
    #############################

    $logFile = [System.IO.Path]::GetTempFileName()
    & "$PSScriptRoot/update-api-schema.ps1" *> $logFile 2>&1
    if ($LASTEXITCODE -ne 0) {
        Get-Content $logFile
        Write-Error "Failed to update API schema"
        Remove-Item $logFile -ErrorAction SilentlyContinue
        exit 1
    }
    Remove-Item $logFile -ErrorAction SilentlyContinue

    $apiPaths = @("Backend/openapi.json","Frontend/src/api-types.ts") | Where-Object { Test-Path $_ }
    $apiDiff = $false
    if ($apiPaths.Count -gt 0) {
        git diff --quiet -- @apiPaths
        $apiDiff = $LASTEXITCODE -ne 0
    }

    if ($apiDiff) {
        Write-Host "OpenAPI schema or frontend types are out of date."
        if ($autoMode) {
            Write-Host "Keeping generated API files."
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

    #############################
    # Check database migrations
    #############################

    # Alembic 1.13+ requires that generated revision files live within one of the
    # configured version locations. Create the temporary directory inside the
    # project's versions folder and specify both locations via --version-path and
    # --version-paths for cross-version compatibility.
    $migrationRoot = Join-Path $repoRoot "Backend/migrations/versions"
    if (-not (Test-Path $migrationRoot)) { throw "Alembic versions directory not found: $migrationRoot" }
    $tmpdir = New-Item -ItemType Directory -Path (Join-Path $migrationRoot ([System.IO.Path]::GetRandomFileName()))
    $versionPaths = "$migrationRoot$([IO.Path]::PathSeparator)$($tmpdir.FullName)"

    # First attempt: new flag set
    alembic revision --autogenerate -m "tmp" --version-path $tmpdir.FullName --version-paths $versionPaths | Out-Null
    if ($LASTEXITCODE -ne 0) {
        # Fallback for older Alembic
        alembic revision --autogenerate -m "tmp" --version-path $tmpdir.FullName | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Remove-Item $tmpdir -Recurse -Force
            Write-Error "Failed to check for migration changes"
            exit 1
        }
    }

    $generated = @(Get-ChildItem $tmpdir -Filter "*.py")
    $needsMigration = $false
    foreach ($f in $generated) {
        $hasUpgrade = Select-String -Path $f.FullName -Pattern 'def upgrade\(' -Quiet -SimpleMatch
        $hasOps     = Select-String -Path $f.FullName -Pattern '\bop\.' -Quiet
        if ($hasUpgrade -and $hasOps) { $needsMigration = $true; break }
    }

    # Clean the temp files before generating the real migration (if any)
    Remove-Item $tmpdir -Recurse -Force

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
                Write-Host "Created migration: $msg"
            } else {
                Write-Host "Skipping migration generation."
            }
        }
    } else {
        Write-Host "Database migrations are up to date."
    }
}
catch {
    Write-Error "$_"
    exit 1
}
finally {
    if ($dbStarted) {
        Write-Host "Shutting down sync database container..."
        docker compose -f $composeFile -p $composeProject down -v | Out-Null
    }
}
