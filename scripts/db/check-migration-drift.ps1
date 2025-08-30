[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Load branch-specific environment to populate TEST_* ports, if available
try {
    . (Join-Path $scriptDir '../lib/branch-env.ps1')
    $null = Set-BranchEnv
} catch { }

if ($env:PYTHON)      { $pythonParts = @($env:PYTHON) }
elseif (Get-Command python  -ErrorAction SilentlyContinue) { $pythonParts = @("python") }
elseif (Get-Command python3 -ErrorAction SilentlyContinue) { $pythonParts = @("python3") }
elseif (Get-Command py      -ErrorAction SilentlyContinue) { $pythonParts = @("py","-3") }
else { Write-Error "Python is required but was not found on PATH"; exit 1 }

$exe    = $pythonParts[0]
$exeArgs = @()
if ($pythonParts.Count -gt 1) { $exeArgs = $pythonParts[1..($pythonParts.Count-1)] }

& $exe $exeArgs (Join-Path $scriptDir 'check_migration_drift.py') @Args
exit $LASTEXITCODE
