# scripts/compose-down-branch.ps1
[CmdletBinding()]
param(
  [switch]$PruneImages,      # Also remove service images created locally
  [switch]$Force             # Skip confirmation prompt
)

function Get-ComposeProjects {
  param(
    [string]$Prefix = 'nutrition-'
  )

  # Prefer `docker compose ls` (Compose v2), fall back to label scan
  $projects = @()

  try {
    $json = docker compose ls --format json 2>$null
    if ($LASTEXITCODE -eq 0 -and $json) {
      $items = $json | ConvertFrom-Json
      if ($items) {
        $projects = $items | Where-Object { $_.Name -like "$Prefix*" } | Select-Object -ExpandProperty Name -Unique
      }
    }
  } catch { }

  if (-not $projects -or $projects.Count -eq 0) {
    # Fallback: find by container label: com.docker.compose.project
    $labelValues = docker ps -a --format '{{.Label "com.docker.compose.project"}}' 2>$null |
      Where-Object { $_ -and ($_ -like "$Prefix*") } |
      Sort-Object -Unique
    $projects = $labelValues
  }

  return $projects
}

function Prioritize-CurrentBranch {
  param(
    [string[]]$Projects
  )
  try {
    $branch = (git rev-parse --abbrev-ref HEAD).Trim()
    if ($branch) {
      $sanitized = ($branch.ToLower() -replace '[^a-z0-9]', '-').Trim('-')
      $currentProj = "nutrition-$sanitized"
      if ($Projects -contains $currentProj) {
        $Projects = @($currentProj) + ($Projects | Where-Object { $_ -ne $currentProj })
      }
    }
  } catch { }
  return $Projects
}

function Select-Projects {
  param(
    [string[]]$Projects
  )
  if (-not $Projects -or $Projects.Count -eq 0) {
    Write-Host "No Compose projects found with the expected prefix." -ForegroundColor Yellow
    return @()
  }
  Write-Host "Select project(s) to delete:" -ForegroundColor Cyan
  for ($i = 0; $i -lt $Projects.Count; $i++) {
    "{0,2}) {1}" -f ($i+1), $Projects[$i]
  }

  $inputIdx = Read-Host "Enter space-separated numbers or 'all'"
  if (-not $inputIdx) { return @() }

  $trimmed = $inputIdx.Trim().ToLower()
  if ($trimmed -eq 'all') { return $Projects }

  $indices = $inputIdx -split '\s+' | Where-Object { $_ -match '^\d+$' } | ForEach-Object { [int]$_ }
  $selection = foreach ($idx in $indices) {
    if ($idx -ge 1 -and $idx -le $Projects.Count) { $Projects[$idx-1] }
  }
  return ($selection | Sort-Object -Unique)
}

# --- Main ---
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$projects = Get-ComposeProjects
$projects = Prioritize-CurrentBranch -Projects $projects
if (-not $projects -or $projects.Count -eq 0) { exit 0 }

$chosen = Select-Projects -Projects $projects
if (-not $chosen -or $chosen.Count -eq 0) {
  Write-Host "Nothing selected. Exiting."
  exit 0
}

if (-not $Force) {
  Write-Host "You are about to delete the following Compose project(s):" -ForegroundColor Yellow
  $chosen | ForEach-Object { Write-Host "  - $_" }
  $confirm = Read-Host "Type 'yes' to proceed"
  if ($confirm -ne 'yes') {
    Write-Host "Cancelled."
    exit 0
  }
}

foreach ($proj in $chosen) {
  Write-Host "Bringing down '$proj'..." -ForegroundColor Cyan
  $args = @('compose','-p', $proj, 'down', '-v', '--remove-orphans')
  if ($PruneImages) {
    $args += @('--rmi','local')
  }

  docker @args

  # Best-effort cleanup for the default network (it’s usually removed by `down` already)
  $defaultNet = "${proj}_default"
  docker network rm $defaultNet 2>$null | Out-Null
}

Write-Host "Done." -ForegroundColor Green
