# scripts/repo/sync-branches.ps1
# Synchronizes local branches and git worktrees with the remote origin.

param(
  [switch]$NoFetch,
  [switch]$YesToAll,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info {
  param([string]$Message)
  Write-Host "[BRANCH SYNC] $Message"
}

function Write-Warn {
  param([string]$Message)
  Write-Warning "[BRANCH SYNC] $Message"
}

function Confirm-Action {
  param([string]$Prompt)
  if ($YesToAll) { return $true }
  $response = Read-Host "$Prompt (y/N)"
  return ($response -match '^[Yy]$')
}

function Normalize-Path {
  param([string]$Path)
  if (-not $Path) { return $null }
  try {
    return (Resolve-Path -LiteralPath $Path).Path
  } catch {
    try {
      return [System.IO.Path]::GetFullPath($Path)
    } catch {
      return $Path
    }
  }
}

function Get-DefaultBranch {
  param([string]$RepoRoot)
  $originHead = git -C $RepoRoot symbolic-ref -q --short refs/remotes/origin/HEAD 2>$null
  if ($LASTEXITCODE -eq 0 -and $originHead) {
    return ($originHead.Trim() -replace '^origin/', '')
  }

  git -C $RepoRoot show-ref --verify --quiet refs/heads/main *> $null
  if ($LASTEXITCODE -eq 0) { return 'main' }

  git -C $RepoRoot show-ref --verify --quiet refs/heads/master *> $null
  if ($LASTEXITCODE -eq 0) { return 'master' }

  return 'main'
}

function Get-Worktrees {
  param([string]$RepoRoot)
  $lines = git -C $RepoRoot worktree list --porcelain
  $results = @()
  $current = [pscustomobject]@{ Path = $null; BranchRef = $null; Detached = $false }

  foreach ($line in $lines) {
    if (-not $line) {
      if ($current.Path) {
        $results += [pscustomobject]@{
          Path = $current.Path
          BranchRef = $current.BranchRef
          Detached = $current.Detached
        }
      }
      $current = [pscustomobject]@{ Path = $null; BranchRef = $null; Detached = $false }
      continue
    }

    switch -Wildcard ($line) {
      'worktree *' {
        $current.Path = $line.Substring('worktree '.Length)
        continue
      }
      'branch *' {
        $current.BranchRef = $line.Substring('branch '.Length)
        continue
      }
      'detached' {
        $current.Detached = $true
        continue
      }
      default { continue }
    }
  }

  if ($current.Path) {
    $results += [pscustomobject]@{
      Path = $current.Path
      BranchRef = $current.BranchRef
      Detached = $current.Detached
    }
  }

  return $results
}

$branchEnvLib = (Resolve-Path (Join-Path $PSScriptRoot '..' 'lib' 'branch-env.ps1')).Path
. $branchEnvLib

$repoRoot = Get-RepoRoot
if (-not $repoRoot) {
  throw 'Unable to resolve repository root.'
}
$repoRoot = Normalize-Path $repoRoot

Write-Info "Repository root: $repoRoot"

if (-not $NoFetch) {
  Write-Info 'Fetching remote updates (git fetch --prune)...'
  $fetchOutput = & git -C $repoRoot fetch --prune 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "git fetch failed:`n$fetchOutput"
  }
  if ($fetchOutput) {
    $fetchOutput | ForEach-Object { Write-Info $_ }
  }
}

$defaultBranch = Get-DefaultBranch -RepoRoot $repoRoot
Write-Info "Default branch: $defaultBranch"

$commonGitDir = (git -C $repoRoot rev-parse --git-common-dir).Trim()
if (-not [System.IO.Path]::IsPathRooted($commonGitDir)) {
  $commonGitDir = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $commonGitDir))
}
$primaryRoot = [System.IO.Path]::GetFullPath((Join-Path $commonGitDir '..'))
$parentDir = Split-Path -Parent $primaryRoot

$localBranches = (& git -C $repoRoot for-each-ref --format '%(refname:short)' refs/heads) | Where-Object { $_ }
$remoteBranches = (& git -C $repoRoot for-each-ref --format '%(refname:short)' refs/remotes/origin) |
  Where-Object { $_ -like "origin/*" -and $_ -ne "origin/HEAD" } |
  ForEach-Object {
    $parts = $_.Split("/", 2)
    if ($parts.Length -eq 2) { $parts[1] }
  } |
  Where-Object { $_ -and $_ -ne "origin" }
$localSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($name in $localBranches) { [void]$localSet.Add($name) }
$remoteSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($name in $remoteBranches) { [void]$remoteSet.Add($name) }

$localOnly = $localBranches | Where-Object { -not $remoteSet.Contains($_) }
$remoteOnly = $remoteBranches | Where-Object { -not $localSet.Contains($_) }

if ($localOnly) {
  Write-Info 'Local branches without matching origin branch:'
  $localOnly | Sort-Object | ForEach-Object { Write-Info "  $_" }
} else {
  Write-Info 'No extra local branches found.'
}

if ($remoteOnly) {
  Write-Info 'Remote branches without local copies:'
  $remoteOnly | Sort-Object | ForEach-Object { Write-Info "  $_" }
  Write-Info 'Create local branches/worktrees for these when you are ready to work on them.'
}

$worktrees = Get-Worktrees -RepoRoot $repoRoot

foreach ($branch in $localOnly | Sort-Object) {
  if ($branch -eq $defaultBranch) { continue }
  Write-Info "Local branch '$branch' is missing from origin."

  $branchWorktrees = $worktrees | Where-Object { $_.BranchRef -eq "refs/heads/$branch" }
  $remainingWorktrees = $false

  foreach ($wt in $branchWorktrees) {
    $wtFull = Normalize-Path $wt.Path

    if ($DryRun) {
      Write-Info "Would remove worktree '$wtFull' for branch '$branch'."
      continue
    }

    if (-not (Confirm-Action "Remove worktree '$wtFull' for branch '$branch'?")) {
      Write-Info "Keeping worktree '$wtFull'."
      $remainingWorktrees = $true
      continue
    }

    $originalLocation = Get-Location
    $relocated = $false
    if ($originalLocation.Path -eq $wtFull) {
      $parentPath = Split-Path -Parent $wtFull
      if (-not $parentPath) { $parentPath = $primaryRoot }
      Set-Location $parentPath
      $relocated = $true
    }

    & git -C $repoRoot worktree remove $wt.Path 2>&1 | ForEach-Object { Write-Info $_ }
    $exitCode = $LASTEXITCODE

    if ($relocated) { Set-Location $originalLocation.Path }

    if ($exitCode -ne 0) {
      Write-Warn "Failed to remove worktree '$wtFull'."
      $remainingWorktrees = $true
    } else {
      Write-Info "Removed worktree '$wtFull'."
    }
  }

  if ($remainingWorktrees) {
    Write-Warn "Branch '$branch' still has active worktrees. Skipping branch deletion."
    continue
  }

  if ($DryRun) {
    Write-Info "Would delete local branch '$branch'."
    continue
  }

  if (-not (Confirm-Action "Delete local branch '$branch'?")) {
    Write-Info "Keeping branch '$branch'."
    continue
  }

  $deleteOutput = & git -C $repoRoot branch -d $branch 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Info "Deleted branch '$branch'."
    continue
  }

  if ($deleteOutput -match 'not fully merged') {
    Write-Warn "Branch '$branch' is not fully merged."
    if (Confirm-Action "Force delete branch '$branch'?") {
      $forceOutput = & git -C $repoRoot branch -D $branch 2>&1
      if ($LASTEXITCODE -eq 0) {
        Write-Info "Force deleted branch '$branch'."
      } else {
        Write-Warn "Failed to force delete branch '$branch':`n$forceOutput"
      }
    } else {
      Write-Info "Keeping branch '$branch'."
    }
  } else {
    Write-Warn "Failed to delete branch '$branch':`n$deleteOutput"
  }
}

if (-not $DryRun) {
  Write-Info 'Pruning stale git worktree entries...'
  & git -C $repoRoot worktree prune 2>&1 | ForEach-Object { Write-Info $_ }
}

# Refresh local data after cleanup
$localBranches = (& git -C $repoRoot for-each-ref --format '%(refname:short)' refs/heads) | Where-Object { $_ }
$localSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)
foreach ($name in $localBranches) { [void]$localSet.Add($name) }

$worktrees = Get-Worktrees -RepoRoot $repoRoot
$worktreeByBranch = @{}
foreach ($wt in $worktrees) {
  if (-not $wt.Detached -and $wt.BranchRef -like 'refs/heads/*') {
    $branchName = $wt.BranchRef.Substring('refs/heads/'.Length)
    if (-not $worktreeByBranch.ContainsKey($branchName)) {
      $worktreeByBranch[$branchName] = @()
    }
    $worktreeByBranch[$branchName] += $wt
  }
}

foreach ($branch in ($localBranches | Sort-Object)) {
  if ($branch -eq $defaultBranch) {
    $primaryFull = Normalize-Path $primaryRoot
    $hasPrimary = $false
    if ($worktreeByBranch.ContainsKey($branch)) {
      foreach ($wt in $worktreeByBranch[$branch]) {
        if (Normalize-Path $wt.Path -eq $primaryFull) {
          $hasPrimary = $true
          break
        }
      }
    }

    if (-not $hasPrimary) {
      Write-Warn "Default branch '$branch' is not checked out in '$primaryFull'."
    }
    continue
  }

  if (-not $localSet.Contains($branch)) { continue }

  $expected = [System.IO.Path]::Combine($parentDir, "nutrition-" + (Get-SanitizedBranch -Branch $branch))
  $expectedFull = Normalize-Path $expected
  if ($worktreeByBranch.ContainsKey($branch)) {
    $branchWorktrees = @($worktreeByBranch[$branch])
  } else {
    $branchWorktrees = @()
  }
  $match = $false
  foreach ($wt in $branchWorktrees) {
    if (Normalize-Path $wt.Path -eq $expectedFull) {
      $match = $true
      break
    }
  }

  if ($match) { continue }

  if ($branchWorktrees.Count -gt 0) {
    $listed = ($branchWorktrees | ForEach-Object { Normalize-Path $_.Path }) -join ', '
    Write-Warn "Branch '$branch' has worktree(s) in unexpected location(s): $listed"
    continue
  }

  if (Test-Path -LiteralPath $expectedFull) {
    Write-Warn "Directory '$expectedFull' exists but is not registered as a worktree for '$branch'. Remove it or attach it manually."
    continue
  }

  if ($DryRun) {
    Write-Info "Would create worktree '$expectedFull' for branch '$branch'."
    continue
  }

  if (-not (Confirm-Action "Create worktree '$expectedFull' for branch '$branch'?")) {
    Write-Info "Skipping worktree creation for '$branch'."
    continue
  }

  & git -C $repoRoot worktree add $expected $branch 2>&1 | ForEach-Object { Write-Info $_ }
  if ($LASTEXITCODE -ne 0) {
    Write-Warn "Failed to create worktree for branch '$branch'."
  } else {
    Write-Info "Created worktree '$expectedFull' for branch '$branch'."
  }
}

Write-Info 'Sync complete. Run scripts/repo/audit-worktrees.ps1 for a final validation if desired.'



