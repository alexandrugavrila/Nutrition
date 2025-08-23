# scripts/update-api-schema.ps1
# Generate the OpenAPI schema and frontend TypeScript types using the current backend models.

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# Ensure we're running from the repository root
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$backendPort = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { 8000 }

# Determine a workable Python command
$python = $env:PYTHON
$pythonArgs = @()
if (-not $python) {
    if (Get-Command python -ErrorAction SilentlyContinue) {
        $python = "python"
    } elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
        $python = "python3"
    } elseif (Get-Command py -ErrorAction SilentlyContinue) {
        $python = "py"
        $pythonArgs = @("-3")
    } else {
        Write-Error "Python is required but was not found on PATH"
        exit 1
    }
}

# Launch the FastAPI app in the background. Ensure that the Python arguments
# array is combined correctly before being passed to Start-Process.
$uvicorn = Start-Process -FilePath $python -ArgumentList ($pythonArgs + @("-m", "uvicorn", "Backend.backend:app", "--port", $backendPort)) -PassThru

try {
    # Wait for the server to be ready and capture the schema
    $maxAttempts = 60
    for ($i = 0; $i -lt $maxAttempts; $i++) {
        try {
            $resp = Invoke-WebRequest -UseBasicParsing "http://localhost:$backendPort/openapi.json"
            [System.IO.File]::WriteAllText("Backend/openapi.json", $resp.Content)
            break
        } catch {
            Start-Sleep -Seconds 1
        }
    }
    if ($i -eq $maxAttempts) {
        throw "Failed to retrieve OpenAPI schema"
    }

    # Generate TypeScript types for the frontend
    npx --prefix Frontend openapi-typescript Backend/openapi.json -o Frontend/src/api-types.ts | Out-Null
} finally {
    if ($uvicorn -and !$uvicorn.HasExited) {
        Stop-Process -Id $uvicorn.Id -Force
        $uvicorn.WaitForExit() | Out-Null
    }
}
