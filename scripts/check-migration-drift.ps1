# scripts/check-migration-drift.ps1
# Verify that database models and migrations are in sync.
# Generates a temporary migration and fails if operations are detected.

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-FreeTcpPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
    $listener.Start()
    $port = ($listener.LocalEndpoint).Port
    $listener.Stop()
    return $port
}

# Ensure we're running from the repository root
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Ensure alembic is available, activating the virtual environment if necessary
$activationLog = [System.IO.Path]::GetTempFileName()
$needActivate = (-not $env:VIRTUAL_ENV) -or (-not (Get-Command alembic -ErrorAction SilentlyContinue))
if ($needActivate) {
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
    Write-Error "alembic command not found"
    exit 1
}

# Start a temporary database container so the script can run without external dependencies.
# The container is removed in the finally block below.
if (-not $env:DB_PORT) { $env:DB_PORT = Get-FreeTcpPort }
$containerName = "nutrition-drift-" + ([Guid]::NewGuid().ToString("N"))

if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = "postgresql://nutrition_user:nutrition_pass@localhost:$($env:DB_PORT)/nutrition"
} else {
    try {
        $builder = [System.UriBuilder]$env:DATABASE_URL
        if ($builder.Port -ne [int]$env:DB_PORT) {
            $builder.Port = [int]$env:DB_PORT
            $env:DATABASE_URL = $builder.Uri.AbsoluteUri.TrimEnd('/')
        }
    } catch {
        $env:DATABASE_URL = $env:DATABASE_URL -replace '(:)\d+(?=/)', "`$1$($env:DB_PORT)"
    }
}

$dbStarted = $false
try {
    Write-Host "Starting temporary database container $containerName on port $($env:DB_PORT)..."
    docker run -d --name $containerName -e POSTGRES_USER=nutrition_user -e POSTGRES_PASSWORD=nutrition_pass -e POSTGRES_DB=nutrition -p $env:DB_PORT:5432 postgres:16 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "failed to start database container" }
    $dbStarted = $true

    Write-Host "Waiting for database to be ready (timeout 2 minutes)..."
    $deadline = (Get-Date).AddMinutes(2)
    do {
        Start-Sleep -Seconds 1
        docker exec $containerName pg_isready -U nutrition_user -d nutrition | Out-Null
        if ((Get-Date) -gt $deadline) { throw "Postgres did not become ready in 2 minutes" }
    } until ($LASTEXITCODE -eq 0)

    # Apply existing migrations
    alembic upgrade head | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "alembic upgrade head failed" }

    # Prepare a temporary directory under the versions folder
    $migrationRoot = Join-Path $repoRoot "Backend/migrations/versions"
    if (-not (Test-Path $migrationRoot)) { throw "Alembic versions directory not found: $migrationRoot" }
    $tmpdir = New-Item -ItemType Directory -Path (Join-Path $migrationRoot ([System.IO.Path]::GetRandomFileName()))

    # Generate a temporary revision
    alembic --version-paths "$migrationRoot;$($tmpdir.FullName)" revision --autogenerate -m "drift check" --version-path $tmpdir.FullName | Out-Null
    if ($LASTEXITCODE -ne 0) { Remove-Item $tmpdir -Recurse -Force; throw "Failed to generate drift check migration" }

    $revision = Get-ChildItem $tmpdir -Filter '*.py' | Select-Object -First 1
    if (-not $revision) { Remove-Item $tmpdir -Recurse -Force; throw "No revision file generated" }

    # Look for any operations in the generated migration
    $hasOps = Select-String -Path $revision.FullName -Pattern '\bop\.' -Quiet
    if ($hasOps) { throw "Migration drift detected. See $($revision.FullName)" }
    Remove-Item $tmpdir -Recurse -Force
    Write-Host "No migration drift detected."
}
catch {
    Write-Error "$_"
    exit 1
}
finally {
    if ($dbStarted) {
        Write-Host "Removing temporary database container $containerName..."
        docker rm -f $containerName | Out-Null
    }
}
