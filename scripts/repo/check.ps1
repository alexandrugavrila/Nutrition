# scripts/repo/check.ps1
# Orchestrates repository health checks by syncing branches and auditing worktrees.

[CmdletBinding()]
param(
  [switch]$SkipSync,
  [switch]$SkipAudit,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$SyncArgs
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $SkipSync) {
  & (Join-Path $scriptDir 'sync-branches.ps1') @SyncArgs
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

if (-not $SkipAudit) {
  & (Join-Path $scriptDir 'audit-worktrees.ps1')
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
