# Ensure the project's virtual environment exists, activate it, and
# install required packages if they are missing

param(
    [string]$VenvPath = (Join-Path (Resolve-Path "$PSScriptRoot/..") ".venv"),
    [string]$RequirementsPath = (Join-Path (Resolve-Path "$PSScriptRoot/..") "Backend/requirements.txt")
)

$venvCreated = $false
if (-Not (Test-Path $VenvPath)) {
    python -m venv $VenvPath
    $venvCreated = $true
}

& "$VenvPath\Scripts\Activate.ps1"

# Install dependencies if the venv was just created or requirements are missing
pip show fastapi > $null 2>&1
if ($venvCreated -or -not $?) {
    pip install -r $RequirementsPath
}
