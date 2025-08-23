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

# Activate the virtual environment unless we're already inside it.
if ($env:VIRTUAL_ENV -ne $VenvPath) {
    & "$VenvPath\Scripts\Activate.ps1"
}

# Install dependencies if the venv was just created or the requirements
# file has changed since the last install. A hash of the requirements file is
# cached inside the venv to avoid unnecessary reinstalls.
$hashPath = Join-Path $VenvPath ".requirements.hash"
$currentHash = (Get-FileHash $RequirementsPath -Algorithm SHA256).Hash

if ($venvCreated -or -not (Test-Path $hashPath) -or (Get-Content $hashPath) -ne $currentHash) {
    pip install -r $RequirementsPath
    Set-Content $hashPath $currentHash
}
