# scripts/repo/audit-container-sets.ps1
# Audits Docker Compose projects that follow the nutrition-<sanitized-branch> naming
# convention and reports container sets that no longer correspond to any existing
# local or remote branch.

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info {
  param([string]$Message)
  Write-Host "[CONTAINER AUDIT] $Message"
}

function Write-ErrorLine {
  param([string]$Message)
  [Console]::Error.WriteLine("[CONTAINER AUDIT] ERROR: $Message")
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Info 'Docker CLI not found. Skipping container set audit.'
  exit 0
}

try {
  docker version --format '{{.Server.Version}}' *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Info 'Docker daemon is not reachable. Skipping container set audit.'
    exit 0
  }
} catch {
  Write-Info 'Docker daemon is not reachable. Skipping container set audit.'
  exit 0
}

$rootDir = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$branchEnvLib = (Resolve-Path (Join-Path $rootDir 'scripts' 'lib' 'branch-env.ps1')).Path
. $branchEnvLib

$repoRoot = Get-RepoRoot
if (-not $repoRoot) {
  throw 'Unable to resolve repository root.'
}

$sanitizedToDesc = [System.Collections.Generic.Dictionary[string,string]]::new([System.StringComparer]::Ordinal)
function Register-Branch {
  param([string]$Sanitized, [string]$Description)
  if ([string]::IsNullOrEmpty($Sanitized)) { return }
  if (-not $sanitizedToDesc.ContainsKey($Sanitized)) {
    $sanitizedToDesc[$Sanitized] = $Description
  }
}

$localBranches = git -C $repoRoot for-each-ref --format '%(refname:short)' refs/heads 2>$null |
  Where-Object { $_ }
foreach ($branch in $localBranches) {
  $sanitized = Get-SanitizedBranch $branch
  Register-Branch $sanitized $branch
}

$remoteRefs = git -C $repoRoot for-each-ref --format '%(refname:short)' refs/remotes 2>$null |
  Where-Object { $_ -and $_ -notlike '*/HEAD' }
foreach ($ref in $remoteRefs) {
  if ($ref -match '^[^/]+/(.+)$') {
    $branch = $Matches[1]
  } else {
    $branch = $ref
  }
  $sanitized = Get-SanitizedBranch $branch
  Register-Branch $sanitized "$branch (remote)"
}

$projectSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
function Add-ProjectsFromText {
  param([string]$Text)
  if (-not $Text) { return }
  foreach ($line in $Text -split "`r?`n") {
    $trim = $line.Trim()
    if ($trim -and $trim -ne '<no value>') {
      [void]$projectSet.Add($trim)
    }
  }
}

try {
  $namesRaw = docker compose ls --format '{{.Name}}' 2>$null
  if ($LASTEXITCODE -eq 0) { Add-ProjectsFromText $namesRaw }
} catch { }

if ($projectSet.Count -eq 0) {
  try {
    $json = docker compose ls --format json 2>$null
    if ($LASTEXITCODE -eq 0 -and $json) {
      $items = $json | ConvertFrom-Json
      if ($items -is [System.Array]) {
        foreach ($item in $items) {
          if ($item.Name) { [void]$projectSet.Add($item.Name) }
        }
      } elseif ($items -and $items.Name) {
        [void]$projectSet.Add($items.Name)
      }
    }
  } catch { }
}

if ($projectSet.Count -eq 0) {
  try {
    $labelsRaw = docker ps -a --format '{{.Label "com.docker.compose.project"}}' 2>$null
    if ($LASTEXITCODE -eq 0) { Add-ProjectsFromText $labelsRaw }
  } catch { }
}

if ($projectSet.Count -eq 0) {
  Write-Info 'No Docker Compose projects detected. Nothing to audit.'
  exit 0
}

$prefix = if ($env:CONTAINER_SET_PREFIX) { $env:CONTAINER_SET_PREFIX } else { 'nutrition-' }
$errors = [System.Collections.Generic.List[pscustomobject]]::new()

foreach ($proj in $projectSet | Sort-Object) {
  if (-not $proj.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) { continue }
  $suffix = $proj.Substring($prefix.Length)
  if (-not $suffix) { continue }

  $candidates = New-Object System.Collections.Generic.List[string]
  $candidates.Add($suffix) | Out-Null
  if ($suffix.EndsWith('-test', [System.StringComparison]::OrdinalIgnoreCase)) {
    $trimmed = $suffix.Substring(0, $suffix.Length - 5)
    if ($trimmed) { $candidates.Add($trimmed) | Out-Null }
  }

  $match = $null
  foreach ($candidate in $candidates) {
    if ($sanitizedToDesc.ContainsKey($candidate)) {
      $match = $candidate
      break
    }
  }

  if ($match) {
    $desc = $sanitizedToDesc[$match]
    Write-Info "Container set '$proj' matches branch '$desc' (OK)"
  } else {
    $names = ($candidates | Sort-Object -Unique) -join ', '
    Write-Info "Container set '$proj' has no matching branch (checked sanitized names: $names)."

    $response = ''
    try {
      $response = Read-Host "Remove this orphaned container set? (y/N)"
    } catch {
      $response = ''
    }

    if ($response -match '^[Yy]$') {
      Write-Info "Removing container set '$proj'..."
      $output = & docker compose -p $proj down -v --remove-orphans 2>&1
      if ($LASTEXITCODE -eq 0) {
        if ($output) { $output | ForEach-Object { Write-Info $_ } }
        Write-Info "Removed container set '$proj'."
        continue
      } else {
        if ($output) { $output | ForEach-Object { Write-ErrorLine $_ } }
        Write-ErrorLine "Failed to remove container set '$proj'."
      }
    } else {
      Write-Info "Keeping container set '$proj'."
    }

    $errors.Add([pscustomobject]@{
      Project = $proj
      Names = $names
    }) | Out-Null
  }
}

if ($errors.Count -gt 0) {
  foreach ($err in $errors) {
    $names = $err.Names
    Write-ErrorLine "Container set '$($err.Project)' has no matching branch (checked sanitized names: $names). Remove with: docker compose -p '$($err.Project)' down -v --remove-orphans"
  }
  exit 1
}

Write-Info 'All container sets map to existing branches.'
