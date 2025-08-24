# scripts/check-migration-drift.ps1
# Ensure Alembic migrations reflect models and produce an up-to-date DB.
#
# Behavior:
#   - Runs a temporary Postgres container.
#   - Applies existing migrations.
#   - Autogenerates a revision to detect drift.
#   - If drift found, adopts it as a real migration (renames + updates header), applies it, then verifies clean.
#
# Exit codes:
#   0 = Up to date (already clean, or adopted migration and verified clean)
#   1 = Script error (infra/tooling failure)
#   2 = Unexpected continued drift after adoption (investigate)

[CmdletBinding()]
param()

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
function Get-FreeTcpPort {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = ($listener.LocalEndpoint).Port
    $listener.Stop()
    return $port
}

# Ensure we're running from the repository root
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Paths
$alembicIni    = Join-Path $repoRoot "Backend/alembic.ini"
$hasAlembicIni = Test-Path $alembicIni
$migrationRoot = Join-Path $repoRoot "Backend/migrations/versions"
if (-not (Test-Path $migrationRoot)) { throw "Alembic versions directory not found: $migrationRoot" }

# Helper to run Alembic with -c if available
function Invoke-Alembic {
    param([Parameter(Mandatory = $true)][string[]]$Args)
    $cmd = @()
    if ($hasAlembicIni) { $cmd += @('-c', $alembicIni) }
    $cmd += $Args
    $null = (& alembic @cmd)
    if ($LASTEXITCODE -ne 0) { throw "alembic $($Args -join ' ') failed" }
}

# Small helpers
function New-ShortRevId { ([Guid]::NewGuid().ToString("N")).Substring(0, 12) }
function New-TimestampSlug { Get-Date -Format "yyyyMMdd_HHmmss" }

# Ensure alembic is available, activating the virtual environment if necessary
$activationLog = [System.IO.Path]::GetTempFileName()
$needActivate = (-not $env:VIRTUAL_ENV) -or (-not (Get-Command alembic -ErrorAction SilentlyContinue))
if ($needActivate) {
    Out-Step "Activating virtual environment..."
    & "$PSScriptRoot/activate-venv.ps1" *> $activationLog 2>&1
    if ($LASTEXITCODE -ne 0) {
        Get-Content $activationLog
        Remove-Item $activationLog -ErrorAction SilentlyContinue
        throw "Failed to activate virtual environment"
    }
}
Remove-Item $activationLog -ErrorAction SilentlyContinue
if (-not (Get-Command alembic -ErrorAction SilentlyContinue)) { throw "alembic command not found" }

# Temp DB container + connection
if (-not $env:DB_PORT) { $env:DB_PORT = Get-FreeTcpPort }
$containerName = "nutrition-drift-" + ([Guid]::NewGuid().ToString("N"))

# Normalize DATABASE_URL to use the chosen port (best-effort)
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

# --- PRE-RUN CLEANUP: remove any stale drift-check temp files -----------------
$driftGlob = "*_driftchecktmp*.py"
Get-ChildItem -Path $migrationRoot -Filter $driftGlob -File -ErrorAction SilentlyContinue | ForEach-Object {
    try { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue } catch {}
}

# State flags
$fatalError = $null
$dbStarted = $false
$firstGenerated = $null
$firstGeneratedPath = $null
$adoptedPath = $null
$verifyGenerated = $null
$verifyGeneratedPath = $null
$adoptionPerformed = $false
$verifyHadOps = $false
$firstHadOps = $false

# --- Functions for core steps -------------------------------------------------
function Start-TempDb {
    Out-Step "Starting temporary database container $containerName on port $($env:DB_PORT)..."
    docker pull postgres:16 | Out-Null
    $runArgs = @(
        'run','-d','--name', $containerName,
        '-e','POSTGRES_USER=nutrition_user',
        '-e','POSTGRES_PASSWORD=nutrition_pass',
        '-e','POSTGRES_DB=nutrition',
        '-p',"$($env:DB_PORT):5432",
        'postgres:16'
    )
    $null = docker @runArgs
    if ($LASTEXITCODE -ne 0) { throw "failed to start database container" }
    $script:dbStarted = $true

    Out-Step "Waiting for database to be ready (timeout 2 minutes)..."
    $deadline = (Get-Date).AddMinutes(2)
    do {
        Start-Sleep -Seconds 1
        $null = docker exec $containerName pg_isready -U nutrition_user -d nutrition
        if ((Get-Date) -gt $deadline) { throw "Postgres did not become ready in 2 minutes" }
    } until ($LASTEXITCODE -eq 0)
    Out-Ok "Database is ready."
}

function New-TempRevision {
    param([string]$message)
    $revId = New-ShortRevId
    $null = Invoke-Alembic @('revision','--autogenerate','--rev-id',$revId,'-m',$message)
    $file = Get-ChildItem $migrationRoot -Filter "$revId*.py" -File | Select-Object -First 1
    if (-not $file) { throw "No revision file generated for rev-id $revId" }
    return $file
}

function Test-RevisionHasOps {
    param([string]$path)
    $text = Get-Content -Raw -Path $path
    $hasRev = [regex]::IsMatch($text,'(?m)^\s*revision\s*=\s*["''][0-9A-Za-z_-]+["'']')
    if (-not $hasRev) { throw "Generated file malformed (no 'revision ='): $path" }
    return [regex]::IsMatch($text,'(?m)^\s*op\.\w+\(')
}

function Convert-DriftFileToMigration {
    param([string]$path)

    $slug = "sync_models_" + (New-TimestampSlug)
    $dir  = Split-Path -Parent $path
    $base = Split-Path -Leaf   $path

    if ($base -match '^(?<rev>[0-9a-fA-F]+)_') { $rev = $Matches['rev'] }
    else { throw "Could not parse revision id from filename: $base" }

    $newName = "${rev}_${slug}.py"
    $newPath = Join-Path $dir $newName

    $content = Get-Content -Raw -Path $path

    # Replace ONLY the first docstring line
    $regex = [System.Text.RegularExpressions.Regex]::new('(?m)^""".*')
    $content = $regex.Replace($content, '"""' + $slug, 1, 0)

    Set-Content -Path $path -Value $content -Encoding UTF8
    Rename-Item -Path $path -NewName $newName
    return $newPath
}

function Clear-TempDriftFiles {
    Get-ChildItem -Path $migrationRoot -Filter $driftGlob -File -ErrorAction SilentlyContinue | ForEach-Object {
        try { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue } catch {}
    }
}

# --------------------------- Main --------------------------------------------
try {
    Start-TempDb

    Out-Step "Applying existing migrations..."
    Invoke-Alembic @('upgrade','head')
    Out-Ok "Migrations applied."

    Out-Step "Autogenerating revision to detect drift..."
    $firstGenerated      = New-TempRevision -message 'driftchecktmp'
    $firstGeneratedPath  = $firstGenerated.FullName
    $firstHadOps         = Test-RevisionHasOps -path $firstGeneratedPath

    if ($firstHadOps) {
        Out-Warn "Drift detected — adopting migration..."
        $adoptedPath        = Convert-DriftFileToMigration -path $firstGeneratedPath
        $adoptionPerformed  = $true

        Out-Step "Applying adopted migration..."
        Invoke-Alembic @('upgrade','head')

        Out-Step "Verifying clean state with a second autogenerate..."
        $verifyGenerated     = New-TempRevision -message 'driftchecktmp_verify'
        $verifyGeneratedPath = $verifyGenerated.FullName
        $verifyHadOps        = Test-RevisionHasOps -path $verifyGeneratedPath

        if (-not $verifyHadOps) {
            Remove-Item $verifyGeneratedPath -Force -ErrorAction SilentlyContinue
            $verifyGeneratedPath = $null
            Out-Ok "Verification clean."
        } else {
            Out-Warn "Verification still shows drift."
        }
    } else {
        Remove-Item $firstGeneratedPath -Force -ErrorAction SilentlyContinue
        $firstGeneratedPath = $null
        Out-Ok "No drift in first autogenerate."
    }
}
catch {
    $fatalError = $_
}
finally {
    if ($dbStarted) {
        Out-Step "Removing temporary database container $containerName..."
        docker rm -f $containerName | Out-Null
    }
    if ($firstGeneratedPath -and (-not $adoptionPerformed)) {
        try { Remove-Item $firstGeneratedPath -Force -ErrorAction SilentlyContinue } catch {}
        $firstGeneratedPath = $null
    }
    if ($verifyGeneratedPath) {
        try { Remove-Item $verifyGeneratedPath -Force -ErrorAction SilentlyContinue } catch {}
        $verifyGeneratedPath = $null
    }
    Clear-TempDriftFiles
}

# --------------------------- Summary & Exit Codes -----------------------------
if ($fatalError) {
    Out-Err  "Script failed: $fatalError"
    Out-Result "Script error" "Red"
    exit 1
}

if ($adoptionPerformed) {
    if ($verifyHadOps) {
        Out-Warn "Adopted $adoptedPath, but verification still shows differences."
        Out-Info "Investigate models or env.py autogenerate settings; noisy configs can cause perpetual diffs."
        Out-Result "Continued drift after adoption" "Yellow"
        exit 2
    } else {
        Out-Ok "Adopted migration: $adoptedPath"
        Out-Ok "Migrations now reproduce the model schema."
        Out-Result "Up to date (after adoption)" "Green"
        exit 0
    }
} else {
    Out-Ok "No migration drift detected."
    Out-Result "Up to date (no drift)" "Green"
    exit 0
}
