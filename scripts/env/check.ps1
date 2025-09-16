# scripts/env/check.ps1
# Verifies that:
# - You are in the correct worktree directory for the current branch
# - The default branch (e.g. main) lives in the primary repo root
# - A Python virtual environment is activated for this worktree

param(
  [switch]$Quiet,
  [switch]$Fix
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info { param([string]$Msg) if(-not $Quiet){ Write-Host "[ENV CHECK] $Msg" } }
function Fail { param([string]$Msg) Write-Error "[ENV CHECK] $Msg"; exit 1 }

# Load helpers from scripts/lib
$libBranchEnv = (Resolve-Path (Join-Path $PSScriptRoot "../lib/branch-env.ps1")).Path
. $libBranchEnv

$repoRoot = Get-RepoRoot
if (-not $repoRoot) { Fail "Could not resolve repository root" }
$branch = (git -C $repoRoot rev-parse --abbrev-ref HEAD).Trim()
if (-not $branch -or $branch -eq 'HEAD') { Fail "Detached HEAD is not supported. Please checkout a branch." }
$sanitized = Get-SanitizedBranch $branch

# Determine default branch (prefer origin/HEAD)
$originHead = (git symbolic-ref -q --short refs/remotes/origin/HEAD 2>$null)
if ($originHead) { $base = $originHead -replace '^origin/', '' }
elseif (git show-ref --verify --quiet refs/heads/main) { $base = 'main' }
elseif (git show-ref --verify --quiet refs/heads/master) { $base = 'master' }
else { $base = 'main' }

$parent = Split-Path -Parent $repoRoot
$desired = Join-Path $parent "nutrition-$sanitized"

# Compute primary root from common git dir
$commonGit = (git -C $repoRoot rev-parse --git-common-dir).Trim()
$primaryRoot = (Resolve-Path (Join-Path $commonGit '..')).Path

Write-Info "Repository root: $repoRoot"
Write-Info "Primary root:    $primaryRoot"
Write-Info "Current branch:  $branch"
Write-Info "Default branch:  $base"

if ($branch -eq $base) {
  if ((Resolve-Path $repoRoot).Path -ne (Resolve-Path $primaryRoot).Path) {
    Fail "Default branch '$base' should be in primary root: $primaryRoot"
  }
}
else {
  if (-not (Test-Path $desired)) {
    # If the branch already has a worktree elsewhere, validate it's not the primary root.
    $existing = $null
    $lines2 = git worktree list --porcelain | Out-String
    $blocks2 = ($lines2 -split "`r?`n`r?`n")
    foreach ($blk in $blocks2) {
      $wt = ($blk -split "`r?`n") | Where-Object { $_ -like 'worktree *' } | ForEach-Object { ($_ -split ' ',3)[1] }
      $br = ($blk -split "`r?`n") | Where-Object { $_ -like 'branch *' }  | ForEach-Object { ($_ -split ' ',3)[1] }
      if ($wt -and $br -and $br -eq "refs/heads/$branch") { $existing = $wt; break }
    }
    if ($existing) {
      $existingFull = [System.IO.Path]::GetFullPath($existing)
      $desiredFull  = [System.IO.Path]::GetFullPath($desired)
      $primaryFull  = [System.IO.Path]::GetFullPath($primaryRoot)
      if ($existingFull -eq $primaryFull) {
        if ($Fix) {
          Write-Info "Creating dedicated worktree for '$branch' at '$desired' (currently checked out in primary root)..."
          $rootHead = (git -C $primaryRoot rev-parse --abbrev-ref HEAD).Trim()
          if ($rootHead -eq $branch) {
            $dirty = git -C $primaryRoot status --porcelain
            if ($dirty) { Fail "Primary worktree ($primaryRoot) has uncommitted changes. Commit/stash before auto-creating worktree." }
            Write-Info "Switching primary worktree to '$base' to free branch..."
            git -C $primaryRoot switch $base | Out-Null
          }
          git worktree add $desired $branch | Out-Null
          Set-Location $desired
          Write-Info "Created and switched to: $desired"
          $venvScript = Join-Path $desired 'scripts\env\activate-venv.ps1'
          if (Test-Path $venvScript) {
            Write-Info "Bootstrapping venv in the new worktree..."
            & $venvScript
          }
          # refresh root after move
          $repoRoot = Get-RepoRoot
        }
        else {
          Fail "Branch '$branch' is currently checked out in the primary root. Re-run with -Fix to create a dedicated worktree at: $desired"
        }
      }
      else {
        if ($Fix) {
          Set-Location $existing
          Write-Info "Using existing dedicated worktree for '$branch' at: $existing"
          $repoRoot = Get-RepoRoot
          # Treat the existing worktree as the expected location for subsequent checks
          $desired = $existing
        }
        else {
          Fail "Branch '$branch' already has a worktree at: $existing`nRe-run with -Fix to switch there."
        }
      }
    }
    elseif ($Fix) {
      Write-Info "Creating worktree for '$branch' at '$desired'..."
      $rootHead = (git -C $primaryRoot rev-parse --abbrev-ref HEAD).Trim()
      if ($rootHead -eq $branch) {
        $dirty = git -C $primaryRoot status --porcelain
        if ($dirty) { Fail "Primary worktree ($primaryRoot) has uncommitted changes. Commit/stash before auto-creating worktree." }
        Write-Info "Switching primary worktree to '$base' to free branch..."
        git -C $primaryRoot switch $base | Out-Null
      }
      git worktree add $desired $branch | Out-Null
      Set-Location $desired
      Write-Info "Created and switched to: $desired"
      $venvScript = Join-Path $desired 'scripts\env\activate-venv.ps1'
      if (Test-Path $venvScript) {
        Write-Info "Bootstrapping venv in the new worktree..."
        & $venvScript
      }
      # refresh root after move
      $repoRoot = Get-RepoRoot
    }
    else {
      Fail "Branch '$branch' should be in its dedicated worktree, but that folder does not exist. Expected: $desired`nCreate it with:`n  git worktree add ..\\nutrition-$sanitized $branch`nOr re-run with -Fix to create and switch."
    }
  }
  # Compare normalized paths; $desired may not have existed earlier
  if ([System.IO.Path]::GetFullPath($repoRoot) -ne [System.IO.Path]::GetFullPath($desired)) {
    if ($Fix) {
      Set-Location $desired
      Write-Info "Switched to branch worktree: $desired"
      $repoRoot = Get-RepoRoot
    }
    else {
      Fail "Branch '$branch' is not in its dedicated worktree. Expected: $desired"
    }
  }
}

# Ensure worktree mapping exists
$wtOk = $false
$lines = git worktree list --porcelain | Out-String
$blocks = ($lines -split "`r?`n`r?`n")
foreach ($blk in $blocks) {
  $wt = ($blk -split "`r?`n") | Where-Object { $_ -like 'worktree *' } | ForEach-Object { ($_ -split ' ',3)[1] }
  $br = ($blk -split "`r?`n") | Where-Object { $_ -like 'branch *' }  | ForEach-Object { ($_ -split ' ',3)[1] }
  if ($wt -and $br -and (Resolve-Path $wt).Path -eq (Resolve-Path $repoRoot).Path -and $br -eq "refs/heads/$branch") {
    $wtOk = $true; break
  }
}
if (-not $wtOk) { Fail "Git worktree mapping not found for branch '$branch' at '$repoRoot'" }
Write-Info "Worktree mapping OK."

# Verify Python venv
$expectedVenv = Join-Path $repoRoot '.venv'
$actualVenv = $env:VIRTUAL_ENV
if (-not $actualVenv) { Fail "Python virtual environment is not activated. Run: .\scripts\env\activate-venv.ps1" }
if ((Resolve-Path $actualVenv).Path -ne (Resolve-Path $expectedVenv).Path) {
  Fail "VIRTUAL_ENV points elsewhere.`n  expected: $expectedVenv`n  actual:   $actualVenv"
}

try {
  $py = & python -c "import sys,os;print(os.path.abspath(sys.executable))"
} catch {
  Fail "Unable to locate python executable. Is the venv active?"
}

if (-not ($py -like "$($expectedVenv)\bin\*" -or $py -like "$($expectedVenv)\Scripts\*")) {
  Fail "Active python ($py) is not from this worktree venv: $expectedVenv"
}

Write-Info "Python venv OK: $expectedVenv"
Write-Info "Environment looks good."
