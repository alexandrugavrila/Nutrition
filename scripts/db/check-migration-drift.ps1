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

. (Join-Path $scriptDir '../lib/python.ps1')
$pythonParts = Get-PythonCommand
$exe    = $pythonParts[0]
$exeArgs = @()
if ($pythonParts.Count -gt 1) { $exeArgs = $pythonParts[1..($pythonParts.Count-1)] }

& $exe $exeArgs (Join-Path $scriptDir 'check_migration_drift.py') @Args
exit $LASTEXITCODE
