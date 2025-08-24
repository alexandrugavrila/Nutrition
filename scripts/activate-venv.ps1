# Ensure the project's virtual environment exists, activate it, and
# install required packages if they are missing

param(
    [string]$VenvPath = (Join-Path (Resolve-Path "$PSScriptRoot/..") ".venv"),
    [string]$RequirementsPath = (Join-Path (Resolve-Path "$PSScriptRoot/..") "Backend/requirements.txt"),
    [string]$FrontendPath = (Join-Path (Resolve-Path "$PSScriptRoot/..") "Frontend")
)

$ErrorActionPreference = 'Stop'

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

# Install npm dependencies if package-lock.json has changed or node_modules is missing.
$packageLockPath = Join-Path $FrontendPath "package-lock.json"
$nodeModulesPath = Join-Path $FrontendPath "node_modules"
$npmHashPath = Join-Path $VenvPath ".npm.hash"

if (Test-Path $packageLockPath) {
    $currentNpmHash = (Get-FileHash $packageLockPath -Algorithm SHA256).Hash
    if ($venvCreated -or -not (Test-Path $nodeModulesPath) -or -not (Test-Path $npmHashPath) -or (Get-Content $npmHashPath) -ne $currentNpmHash) {
        Push-Location $FrontendPath
        npm install
        Pop-Location
        Set-Content $npmHashPath $currentNpmHash
    }
}
