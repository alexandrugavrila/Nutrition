param(
    [string]$Email,
    [string]$UserId
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$PythonScript = Join-Path $ScriptDir "seed-starter-data.py"

$argsList = @($PythonScript)
if ($Email) {
    $argsList += @("--email", $Email)
} elseif ($UserId) {
    $argsList += @("--user-id", $UserId)
} else {
    throw "Provide either -Email or -UserId."
}

Push-Location $RepoRoot
try {
    python @argsList
} finally {
    Pop-Location
}
