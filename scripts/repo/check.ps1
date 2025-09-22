# scripts/repo/check.ps1
# Orchestrates repository health checks by syncing branches, auditing worktrees, and flagging stale container sets.

[CmdletBinding()]
param(
  [switch]$SkipSync,
  [switch]$SkipAudit,
  [switch]$SkipContainers,
  [switch]$YesToAll,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$SyncArgs
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $SkipSync) {
  $effectiveSyncArgs = @()
  if ($SyncArgs) { $effectiveSyncArgs += $SyncArgs }
  if ($YesToAll -and -not ($effectiveSyncArgs | Where-Object { $_ -ieq '-YesToAll' })) {
    $effectiveSyncArgs += '-YesToAll'
  }

  & (Join-Path $scriptDir 'sync-branches.ps1') @effectiveSyncArgs
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

if (-not $SkipContainers) {
  $containerArgs = @()
  if ($YesToAll) { $containerArgs += '-YesToAll' }

  & (Join-Path $scriptDir 'audit-container-sets.ps1') @containerArgs
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
