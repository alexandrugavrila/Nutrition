# scripts/db/export-to-csv.ps1
[CmdletBinding()]
param(
  [switch]$Production,
  [switch]$Test,
  [string]$OutputDir
)

function Show-Usage {
  Write-Host "Usage: pwsh ./scripts/db/export-to-csv.ps1 [-Production|-Test] [--OutputDir <path>]" -ForegroundColor Yellow
  Write-Host "  Defaults to production exports when no flag is provided."
}

if ($Production -and $Test) {
  Show-Usage
  exit 1
}

. "$PSScriptRoot/../lib/log.ps1"
. "$PSScriptRoot/../lib/branch-env.ps1"
. "$PSScriptRoot/../lib/venv.ps1"
. "$PSScriptRoot/../lib/compose-utils.ps1"
$envInfo = Set-BranchEnv
Set-Location $envInfo.RepoRoot

Ensure-Venv
Ensure-BranchContainers | Out-Null

$argsList = @()
if ($Test) { $argsList += '--test' }
elseif ($Production) { $argsList += '--production' }

if ($OutputDir) {
  $resolved = Resolve-Path -LiteralPath $OutputDir -ErrorAction SilentlyContinue
  if ($resolved) { $argsList += @('--output-dir', $resolved.Path) }
  else { $argsList += @('--output-dir', $OutputDir) }
}

python Database/export_to_csv.py @argsList
