# scripts/db/update-api-schema.ps1
# Generate the OpenAPI schema and frontend TypeScript types using the current backend models.
# Behavior:
#   - Ensures the Python virtual environment is active (via activate-venv.ps1).
#   - Launches the FastAPI backend with uvicorn.
#   - Waits for the server to become ready.
#   - Saves Backend/openapi.json.
#   - Runs openapi-typescript to produce Frontend/src/api-types.ts.
#
# Exit codes:
#   0 = Success
#   1 = Script error (tooling failure, server did not start, etc.)

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
function Get-PythonCommand {
    if ($env:PYTHON) { return ,@($env:PYTHON) }
    elseif (Get-Command python  -ErrorAction SilentlyContinue) { return ,@("python") }
    elseif (Get-Command python3 -ErrorAction SilentlyContinue) { return ,@("python3") }
    elseif (Get-Command py      -ErrorAction SilentlyContinue) { return ,@("py","-3") }
    else { throw "Python is required but was not found on PATH" }
}

function Wait-ForBackend {
    param([int]$port, [int]$timeoutSeconds = 60)
    $deadline = (Get-Date).AddSeconds($timeoutSeconds)
    do {
        try {
            $resp = Invoke-WebRequest -UseBasicParsing "http://localhost:$port/openapi.json" -TimeoutSec 5
            if ($resp.StatusCode -eq 200) {
                [System.IO.File]::WriteAllText("Backend/openapi.json", $resp.Content)
                return $true
            }
        } catch {
            Start-Sleep -Seconds 1
        }
    } until ((Get-Date) -gt $deadline)
    return $false
}

# --------------------------- Setup -------------------------------------------
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repoRoot

$backendPort = if ($env:DEV_BACKEND_PORT) { $env:DEV_BACKEND_PORT } else { 8000 }

# Ensure venv is active
$activationLog = [System.IO.Path]::GetTempFileName()
$needActivate = (-not $env:VIRTUAL_ENV)
if ($needActivate) {
    Out-Step "Activating virtual environment..."
    & "$PSScriptRoot/../env/activate-venv.ps1" *> $activationLog 2>&1
    if ($LASTEXITCODE -ne 0) {
        Get-Content $activationLog
        Remove-Item $activationLog -ErrorAction SilentlyContinue
        throw "Failed to activate virtual environment"
    }
}
Remove-Item $activationLog -ErrorAction SilentlyContinue

# Choose python (prefer venv-provided)
$pythonParts = Get-PythonCommand
$pythonExe   = $pythonParts[0]
$pythonArgs  = @()
if ($pythonParts.Count -gt 1) { $pythonArgs = $pythonParts[1..($pythonParts.Count-1)] }

$fatalError = $null
$serverProc = $null

# --------------------------- Main --------------------------------------------
try {
    Out-Step "Starting backend server on port $backendPort..."
    $serverProc = Start-Process -FilePath $pythonExe `
                                -ArgumentList ($pythonArgs + @("-m","uvicorn","Backend.backend:app","--port",$backendPort)) `
                                -NoNewWindow -PassThru

    Out-Step "Waiting for backend to become ready..."
    if (-not (Wait-ForBackend -port $backendPort -timeoutSeconds 60)) {
        throw "Failed to retrieve OpenAPI schema"
    }
    Out-Ok "Saved OpenAPI to Backend/openapi.json"

    Out-Step "Generating TypeScript types for frontend..."
    npx --prefix Frontend openapi-typescript Backend/openapi.json -o Frontend/src/api-types.ts | Out-Null
    Out-Ok "Generated Frontend/src/api-types.ts"
}
catch {
    $fatalError = $_
}
finally {
    if ($serverProc -and -not $serverProc.HasExited) {
        Out-Step "Stopping backend server..."
        Stop-Process -Id $serverProc.Id -Force
        $serverProc.WaitForExit() | Out-Null
    }
}

# --------------------------- Summary & Exit Codes ----------------------------
if ($fatalError) {
    Out-Err  "Script failed: $fatalError"
    Out-Result "Script error" "Red"
    exit 1
}
else {
    Out-Ok "OpenAPI schema and types updated successfully."
    Out-Result "Success" "Green"
    exit 0
}
