#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Interactively switch the branch used by this worktree.
.DESCRIPTION
    Fetches the latest refs, shows existing worktrees, and helps you move this worktree to a new branch.
.PARAMETER Branch
    Optional target branch to switch to. If omitted the script prompts for one.
.PARAMETER Force
    Proceed even when the worktree has uncommitted changes (requires confirmation).
.PARAMETER Remote
    Remote name to fetch from and use when creating tracking branches. Defaults to origin.
#>
[CmdletBinding()]
param(
    [string]$Branch,
    [switch]$Force,
    [string]$Remote = 'origin'
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    $output = & git @Args 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "git $($Args -join ' ') failed with exit code $exitCode`n$output"
    }

    return $output
}

function Normalize-Path {
    param(
        [Parameter(Mandatory = $true)][string]$PathValue
    )

    return ([System.IO.Path]::GetFullPath($PathValue)).TrimEnd([char]92,'/')
}

function Test-LocalBranch {
    param(
        [Parameter(Mandatory = $true)][string]$Name
    )

    & git show-ref --verify --quiet ("refs/heads/$Name") > $null 2>&1
    return ($LASTEXITCODE -eq 0)
}

function Test-RemoteBranch {
    param(
        [Parameter(Mandatory = $true)][string]$RemoteName,
        [Parameter(Mandatory = $true)][string]$Name
    )

    & git ls-remote --exit-code --heads $RemoteName $Name > $null 2>&1
    return ($LASTEXITCODE -eq 0)
}

function Parse-Worktrees {
    param([string[]]$Lines)

    $entries = @()
    $current = @{}

    foreach ($line in $Lines) {
        if ([string]::IsNullOrWhiteSpace($line)) {
            if ($current.ContainsKey('Path')) {
                $entries += [pscustomobject]@{
                    Path   = Normalize-Path $current.Path
                    Branch = if ($current.ContainsKey('Branch')) { $current.Branch } else { $null }
                }
            }
            $current = @{}
            continue
        }

        $parts = $line.Split(' ', 2)
        if ($parts.Count -lt 2) { continue }

        switch ($parts[0]) {
            'worktree' { $current.Path = $parts[1] }
            'branch' {
                $branchValue = $parts[1]
                if ($branchValue -eq 'detached') {
                    $current.Branch = $null
                }
                else {
                    if ($branchValue.StartsWith('refs/heads/')) {
                        $branchValue = $branchValue.Substring(11)
                    }
                    $current.Branch = $branchValue
                }
            }
            default { }
        }
    }

    if ($current.ContainsKey('Path')) {
        $entries += [pscustomobject]@{
            Path   = Normalize-Path $current.Path
            Branch = if ($current.ContainsKey('Branch')) { $current.Branch } else { $null }
        }
    }

    return $entries
}

function Get-LastLine {
    param([Parameter(Mandatory = $true)]$Lines)

    return [string]($Lines | Select-Object -Last 1)
}

$repoRootRaw = Get-LastLine (Invoke-Git @('rev-parse','--show-toplevel'))
if (-not $repoRootRaw) {
    throw 'Unable to determine repository root. Is this a git worktree?'
}
Set-Location $repoRootRaw
$repoRoot = Normalize-Path $repoRootRaw

$currentBranch = Get-LastLine (Invoke-Git @('rev-parse','--abbrev-ref','HEAD'))

$statusLines = Invoke-Git @('status','--porcelain')
$hasPendingChanges = $false
foreach ($line in $statusLines) {
    $text = [string]$line
    if ($text.Trim().Length -gt 0) {
        $hasPendingChanges = $true
        break
    }
}
if ($hasPendingChanges) {
    if (-not $Force) {
        Write-Error 'Worktree has uncommitted changes. Commit or stash them, or rerun with -Force.'
        exit 1
    }

    $confirmation = Read-Host "Force enabled. Type YES to continue despite uncommitted changes"
    if ($confirmation -ne 'YES') {
        Write-Host 'Aborting.'
        exit 1
    }
}

Write-Host "Fetching latest refs from '$Remote'..."
Invoke-Git @('fetch',$Remote,'--prune') | Out-Null

$worktreeLines = Invoke-Git @('worktree','list','--porcelain')
$worktrees = Parse-Worktrees $worktreeLines

Write-Host ''
Write-Host 'Existing worktrees:'
foreach ($wt in $worktrees) {
    $marker = if ($wt.Path -eq $repoRoot) { '>' } else { ' ' }
    $branchLabel = if ($wt.Branch) { $wt.Branch } else { '<detached>' }
    Write-Host (" $marker $branchLabel -> $($wt.Path)")
}
Write-Host ''

if (-not $Branch) {
    $Branch = Read-Host 'Enter the branch to use in this worktree'
}
$Branch = $Branch.Trim()
if (-not $Branch) {
    Write-Error 'No branch name supplied.'
    exit 1
}

if ($Branch -eq $currentBranch) {
    Write-Host "Already on branch '$Branch'."
    exit 0
}

$matching = $worktrees | Where-Object { $_.Branch -eq $Branch }
$otherMatches = $matching | Where-Object { $_.Path -ne $repoRoot }
if ($otherMatches.Count -gt 0) {
    Write-Host "Branch '$Branch' is already checked out in these worktrees:"
    foreach ($item in $otherMatches) {
        Write-Host "  - $($item.Path)"
    }
    Write-Host 'Open the listed worktree or move it to another branch before retrying.'
    exit 1
}

$branchExists = Test-LocalBranch -Name $Branch
$track = $false
$baseRef = $null

if (-not $branchExists) {
    $remoteHasBranch = Test-RemoteBranch -RemoteName $Remote -Name $Branch
    if ($remoteHasBranch) {
        $response = Read-Host "Create local branch '$Branch' tracking '$Remote/$Branch'? (Y/n)"
        if ($response -and $response.Trim().ToLower().StartsWith('n')) {
            $baseRef = Read-Host "Enter the base ref to create '$Branch' from (leave blank to abort)"
            if (-not $baseRef) {
                Write-Host 'Aborting.'
                exit 1
            }
        }
        else {
            $baseRef = "$Remote/$Branch"
            $track = $true
        }
    }
    else {
        $baseRef = Read-Host "Branch '$Branch' not found locally or on '$Remote'. Enter a base ref (leave blank to abort)"
        if (-not $baseRef) {
            Write-Host 'Aborting.'
            exit 1
        }
    }
}

if ($branchExists) {
    Write-Host "Switching to existing branch '$Branch'..."
    Invoke-Git @('switch',$Branch) | Out-Null
}
else {
    if ($track) {
        Write-Host "Creating branch '$Branch' tracking '$baseRef'..."
        Invoke-Git @('switch','--create',$Branch,'--track',$baseRef) | Out-Null
    }
    else {
        Write-Host "Creating branch '$Branch' from '$baseRef'..."
        Invoke-Git @('switch','--create',$Branch,$baseRef) | Out-Null
    }
}

Write-Host ''
Write-Host 'Current branch:'
$current = Get-LastLine (Invoke-Git @('rev-parse','--abbrev-ref','HEAD'))
Write-Host "  $current"

Write-Host ''
Write-Host 'Status:'
$summary = Invoke-Git @('status','-sb')
foreach ($line in $summary) {
    Write-Host "  $line"
}
