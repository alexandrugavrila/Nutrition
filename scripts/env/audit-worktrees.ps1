# scripts/env/audit-worktrees.ps1
# Audits git worktrees to ensure each branch maps to exactly one worktree
# and follows the nutrition-<branch> naming scheme used by the bash version.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info {
  param([string]$Message)
  Write-Host "[WORKTREE AUDIT] $Message"
}

function Add-Error {
  param([string]$Message)
  $script:Errors.Add($Message) | Out-Null
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
  $originHead = git symbolic-ref -q --short refs/remotes/origin/HEAD 2>$null
  if ($LASTEXITCODE -eq 0 -and $originHead) {
    return ($originHead.Trim() -replace '^origin/', '')
  }

  git show-ref --verify --quiet refs/heads/main *> $null
  if ($LASTEXITCODE -eq 0) { return 'main' }

  git show-ref --verify --quiet refs/heads/master *> $null
  if ($LASTEXITCODE -eq 0) { return 'master' }

  return 'main'
}

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$branchEnvLib = (Resolve-Path (Join-Path $rootDir 'scripts' 'lib' 'branch-env.ps1')).Path
. $branchEnvLib

$repoRoot = Get-RepoRoot
if (-not $repoRoot) {
  throw 'Unable to resolve repository root.'
}

$commonGitDir = (git -C $repoRoot rev-parse --git-common-dir).Trim()
if (-not [System.IO.Path]::IsPathRooted($commonGitDir)) {
  $commonGitDir = [System.IO.Path]::GetFullPath((Join-Path $repoRoot $commonGitDir))
}
$primaryRoot = [System.IO.Path]::GetFullPath((Join-Path $commonGitDir '..'))
$parentDir = Split-Path -Parent $primaryRoot
$defaultBranch = Get-DefaultBranch

Write-Info "Primary worktree root: $primaryRoot"
Write-Info "Worktree parent dir:  $parentDir"
Write-Info "Default branch:       $defaultBranch"

$branchToWorktree = [System.Collections.Generic.Dictionary[string,string]]::new()
$expectedToBranch = [System.Collections.Generic.Dictionary[string,string]]::new()
$script:Errors = [System.Collections.Generic.List[string]]::new()

$script:CurrentWorktree = $null
$script:CurrentBranchRef = $null
$script:CurrentDetached = $false

function Process-Entry {
  $wt = $script:CurrentWorktree
  $branchRef = $script:CurrentBranchRef
  $detached = $script:CurrentDetached

  if (-not $wt) {
    $script:CurrentWorktree = $null
    $script:CurrentBranchRef = $null
    $script:CurrentDetached = $false
    return
  }

  if (-not (Test-Path -LiteralPath $wt)) {
    Add-Error "Worktree path does not exist: $wt"
    $wt = $null
  }

  if ($detached) {
    Add-Error "Worktree '$($script:CurrentWorktree)' is in a detached HEAD state. Attach it to a branch."
  }
  elseif (-not $branchRef) {
    Add-Error "Worktree '$($script:CurrentWorktree)' is missing branch information."
  }
  elseif ($branchRef -notlike 'refs/heads/*') {
    Add-Error "Worktree '$($script:CurrentWorktree)' is attached to unexpected ref '$branchRef' (expected refs/heads/...)."
  }
  else {
    $branch = $branchRef.Substring('refs/heads/'.Length)

    if ($branchToWorktree.ContainsKey($branch)) {
      Add-Error "Branch '$branch' has multiple worktrees: '${branchToWorktree[$branch]}' and '$($script:CurrentWorktree)'"
    }
    else {
      $branchToWorktree[$branch] = $script:CurrentWorktree
    }

    if ($branch -eq $defaultBranch) {
      $expected = $primaryRoot
    }
    else {
      $sanitized = Get-SanitizedBranch $branch
      $expected = [System.IO.Path]::Combine($parentDir, "nutrition-$sanitized")
    }

    if ($expectedToBranch.ContainsKey($expected) -and $expectedToBranch[$expected] -ne $branch) {
      Add-Error "Branches '$branch' and '${expectedToBranch[$expected]}' both map to expected worktree '$expected'."
    }
    else {
      $expectedToBranch[$expected] = $branch
    }

    $wtFull = Normalize-Path $script:CurrentWorktree
    $expectedFull = Normalize-Path $expected

    if ($wtFull -ne $expectedFull) {
      if ($branch -eq $defaultBranch) {
        Add-Error "Default branch '$branch' should be in '$expected' but worktree is at '$($script:CurrentWorktree)'"
      }
      else {
        Add-Error "Worktree for branch '$branch' should be '$expected' but found '$($script:CurrentWorktree)'"
      }
    }
    else {
      Write-Info "Branch '$branch' -> $wtFull (OK)"
    }
  }

  $script:CurrentWorktree = $null
  $script:CurrentBranchRef = $null
  $script:CurrentDetached = $false
}

$lines = git -C $repoRoot worktree list --porcelain
foreach ($line in $lines) {
  if (-not $line) {
    Process-Entry
    continue
  }

  switch -Wildcard ($line) {
    'worktree *' {
      $script:CurrentWorktree = $line.Substring('worktree '.Length)
      continue
    }
    'branch *' {
      $script:CurrentBranchRef = $line.Substring('branch '.Length)
      continue
    }
    'detached' {
      $script:CurrentDetached = $true
      continue
    }
    default { continue }
  }
}

Process-Entry

if ($script:Errors.Count -gt 0) {
  foreach ($err in $script:Errors) {
    [Console]::Error.WriteLine("[WORKTREE AUDIT] ERROR: $err")
  }
  exit 1
}

Write-Info 'All worktrees match the expected layout.'
