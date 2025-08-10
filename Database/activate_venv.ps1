# Ensure the project's virtual environment exists and activate it

param(
    [string]$VenvPath = (Join-Path (Resolve-Path "$PSScriptRoot/..") ".venv")
)

if (-Not (Test-Path $VenvPath)) {
    python -m venv $VenvPath
}

& "$VenvPath\Scripts\Activate.ps1"
