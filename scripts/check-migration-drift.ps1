# scripts/check-migration-drift.ps1
# Verify that database models and migrations are in sync.
# Generates a temporary migration and fails if operations are detected.

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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

# Apply existing migrations
alembic upgrade head | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Error "alembic upgrade head failed"
    exit 1
}

# Prepare a temporary directory under the versions folder
$migrationRoot = Join-Path $repoRoot "Backend/migrations/versions"
if (-not (Test-Path $migrationRoot)) {
    Write-Error "Alembic versions directory not found: $migrationRoot"
    exit 1
}
$tmpdir = New-Item -ItemType Directory -Path (Join-Path $migrationRoot ([System.IO.Path]::GetRandomFileName()))

# Generate a temporary revision
alembic --version-paths "$migrationRoot;$($tmpdir.FullName)" revision --autogenerate -m "drift check" --version-path $tmpdir.FullName | Out-Null
if ($LASTEXITCODE -ne 0) {
    Remove-Item $tmpdir -Recurse -Force
    Write-Error "Failed to generate drift check migration"
    exit 1
}

$revision = Get-ChildItem $tmpdir -Filter '*.py' | Select-Object -First 1
if (-not $revision) {
    Remove-Item $tmpdir -Recurse -Force
    Write-Error "No revision file generated"
    exit 1
}

# Look for any operations in the generated migration
$hasOps = Select-String -Path $revision.FullName -Pattern '\bop\.' -Quiet
if ($hasOps) {
    Write-Error "Migration drift detected. See $($revision.FullName)"
    exit 1
} else {
    Remove-Item $tmpdir -Recurse -Force
    Write-Host "No migration drift detected."
}
