# scripts/check-migration-drift.ps1
# Ensure Alembic migrations reflect models and produce an up-to-date DB.

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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

# --- Functions for core steps (renamed with approved verbs) -------------------
function Start-TempDb {
    Write-Host "Starting temporary database container $containerName on port $($env:DB_PORT)..."
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

    Write-Host "Waiting for database to be ready (timeout 2 minutes)..."
    $deadline = (Get-Date).AddMinutes(2)
    do {
        Start-Sleep -Seconds 1
        $null = docker exec $containerName pg_isready -U nutrition_user -d nutrition
        if ((Get-Date) -gt $deadline) { throw "Postgres did not become ready in 2 minutes" }
    } until ($LASTEXITCODE -eq 0)
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

    # Replace ONLY the first line that starts the docstring (opening triple quotes line)
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

try {
    Start-TempDb

    # Apply existing migrations
    Invoke-Alembic @('upgrade','head')

    # First autogenerate: detect drift
    $firstGenerated      = New-TempRevision -message 'driftchecktmp'
    $firstGeneratedPath  = $firstGenerated.FullName
    $firstHadOps         = Test-RevisionHasOps -path $firstGeneratedPath

    if ($firstHadOps) {
        Write-Host "Drift detected, adopting migration..." -ForegroundColor Yellow
        $adoptedPath        = Convert-DriftFileToMigration -path $firstGeneratedPath
        $adoptionPerformed  = $true

        Invoke-Alembic @('upgrade','head')

        $verifyGenerated     = New-TempRevision -message 'driftchecktmp_verify'
        $verifyGeneratedPath = $verifyGenerated.FullName
        $verifyHadOps        = Test-RevisionHasOps -path $verifyGeneratedPath

        if (-not $verifyHadOps) {
            Remove-Item $verifyGeneratedPath -Force -ErrorAction SilentlyContinue
            $verifyGeneratedPath = $null
        }
    } else {
        Remove-Item $firstGeneratedPath -Force -ErrorAction SilentlyContinue
        $firstGeneratedPath = $null
    }
}
catch {
    $fatalError = $_
}
finally {
    if ($dbStarted) {
        Write-Host "Removing temporary database container $containerName..."
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
    Write-Error "Script failed: $fatalError"
    Write-Host "[RESULT] Script error" -ForegroundColor Red
    exit 1
}

if ($adoptionPerformed) {
    if ($verifyHadOps) {
        Write-Warning "Adopted $adoptedPath, but a verification autogenerate still found differences."
        Write-Host "Investigate your models/env.py autogenerate settings. A noisy config can cause perpetual diffs." -ForegroundColor Yellow
        Write-Host "[RESULT] Continued drift after adoption" -ForegroundColor Yellow
        exit 2
    } else {
        Write-Host "Adopted migration: $adoptedPath" -ForegroundColor Green
        Write-Host "Verification clean: migrations now reproduce the model schema." -ForegroundColor Green
        Write-Host "[RESULT] Up to date (after adoption)" -ForegroundColor Green
        exit 0
    }
} else {
    Write-Host "No migration drift detected." -ForegroundColor Green
    Write-Host "[RESULT] Up to date (no drift)" -ForegroundColor Green
    exit 0
}
