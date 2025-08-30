#!/usr/bin/env pwsh
# scripts/compose.ps1
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [ValidateSet('up','down','restart')]
  [string]$Subcommand,
  [switch]$production,
  [switch]$test,
  [switch]$empty,
  [switch]$PruneImages,
  [switch]$Force,
  [string[]]$Services
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Show-Usage {
  Write-Host ""
  Write-Host "Usage:" -ForegroundColor Yellow
  Write-Host "  pwsh ./scripts/compose.ps1 <subcommand> [options] [service ...]"
  Write-Host ""
  Write-Host "Subcommands:" -ForegroundColor Yellow
  Write-Host "  up       - start services (-production|-test|-empty)"
  Write-Host "  down     - stop services [-PruneImages] [-Force]"
  Write-Host "  restart  - restart services (-production|-test|-empty)"
  Write-Host ""
  Write-Host "Examples:" -ForegroundColor Yellow
  Write-Host "  pwsh ./scripts/compose.ps1 up -test"
  Write-Host "  pwsh ./scripts/compose.ps1 down -PruneImages"
  Write-Host "  pwsh ./scripts/compose.ps1 restart -empty backend frontend"
  Write-Host ""
}

function Get-Branch {
  (git rev-parse --abbrev-ref HEAD).Trim()
}

function Get-SanitizedBranch([string]$branch) {
  ($branch.ToLower() -replace '[^a-z0-9]', '-').Trim('-')
}

function Get-Project {
  $branch = Get-Branch
  $san = Get-SanitizedBranch $branch
  return "nutrition-$san"
}

function Set-BranchPorts {
  $branch = Get-Branch
  $offset = [math]::Abs($branch.GetHashCode()) % 100
  $env:DB_PORT = 5432 + $offset
  $env:BACKEND_PORT = 8000 + $offset
  $env:FRONTEND_PORT = 3000 + $offset
  $env:DATABASE_URL = "postgresql://nutrition_user:nutrition_pass@localhost:$($env:DB_PORT)/nutrition"
}

function Compose-Up {
  param([switch]$production,[switch]$test,[switch]$empty,[string[]]$Services)

  $modeCount = 0
  if ($production) { $modeCount++ }
  if ($test) { $modeCount++ }
  if ($empty) { $modeCount++ }
  if ($modeCount -ne 1) {
    Write-Error "You must specify exactly one of: -production, -test, or -empty."
    return
  }

  $repoRoot = Resolve-Path "$PSScriptRoot/.."
  Set-Location $repoRoot

  $branch = Get-Branch
  $project = Get-Project
  Set-BranchPorts

  Write-Host "Starting '$branch' with ports:`n  DB: $env:DB_PORT`n  Backend: $env:BACKEND_PORT`n  Frontend: $env:FRONTEND_PORT"

  try {
    docker compose -p $project up -d @Services | Out-Null
  } catch {
    Write-Error "Failed to start services."
    return
  }

  if ($empty) {
    Write-Host "Starting with empty database."
    return
  }

  Write-Host "Waiting for database to be ready..."
  $deadline = (Get-Date).AddSeconds(120)
  while ($true) {
    try {
      docker compose -p $project exec -T db pg_isready -U nutrition_user -d nutrition *> $null
      break
    } catch {
      if ((Get-Date) -ge $deadline) { Write-Error "Database did not become ready within the timeout."; return }
      Start-Sleep -Seconds 1
    }
  }

  Write-Host "Waiting for backend dependencies (alembic) to be ready..."
  $deadline = (Get-Date).AddSeconds(180)
  while ($true) {
    try {
      docker compose -p $project exec -T backend sh -lc 'python -m pip show alembic >/dev/null 2>&1' *> $null
      break
    } catch {
      if ((Get-Date) -ge $deadline) { Write-Error "Backend did not finish installing dependencies (alembic not available) within timeout."; return }
      Start-Sleep -Seconds 1
    }
  }

  Write-Host "Applying database migrations..."
  docker compose -p $project exec -T backend python -m alembic upgrade head | Out-Null

  if ($production -or $test) {
    & "$PSScriptRoot/activate-venv.ps1"
    if ($LASTEXITCODE -ne 0) { return }
    if ($production) {
      Write-Host "Importing production data..."
      python Database/import_from_csv.py --production
    } else {
      Write-Host "Importing test data..."
      python Database/import_from_csv.py --test
    }
  }

  Write-Host "Done."
}

function Get-ComposeProjects([string]$prefix='nutrition-') {
  $projects = @()
  try {
    $json = docker compose ls --format json | ConvertFrom-Json
    foreach ($it in $json) {
      if ($it.Name -like "$prefix*") { $projects += $it.Name }
    }
  } catch { }
  if (-not $projects) {
    try {
      $projects = docker ps -a --format '{{.Label "com.docker.compose.project"}}' | Where-Object { $_ -like "$prefix*" } | Sort-Object -Unique
    } catch { }
  }
  return $projects
}

function Prioritize-CurrentBranch([string[]]$projects) {
  $branch = Get-Branch
  if ($branch) {
    $san = Get-SanitizedBranch $branch
    $current = "nutrition-$san"
    if ($projects -contains $current) {
      return ,$current + ($projects | Where-Object { $_ -ne $current })
    }
  }
  return $projects
}

function Select-Projects([string[]]$projects) {
  if (-not $projects) {
    Write-Warning "No Compose projects found with the expected prefix."
    return @()
  }
  Write-Host "Select project(s) to delete:"
  for ($i=0; $i -lt $projects.Count; $i++) {
    "{0,2}) {1}" -f ($i+1), $projects[$i]
  }
  $input = Read-Host "Enter space-separated numbers or 'all'"
  if (-not $input) { return @() }
  if ($input -eq 'all') { return $projects }
  $selection = @()
  foreach ($idx in $input -split '\s+') {
    if ($idx -match '^\d+$') {
      $i = [int]$idx - 1
      if ($i -ge 0 -and $i -lt $projects.Count) { $selection += $projects[$i] }
    }
  }
  return ($selection | Sort-Object -Unique)
}

function Compose-Down {
  param([switch]$PruneImages,[switch]$Force)

  $repoRoot = Resolve-Path "$PSScriptRoot/.."
  Set-Location $repoRoot

  $projects = Get-ComposeProjects
  $projects = Prioritize-CurrentBranch $projects
  if (-not $projects) { return }

  $chosen = Select-Projects $projects
  if (-not $chosen) { Write-Host "Nothing selected. Exiting."; return }

  if (-not $Force) {
    Write-Host "You are about to delete the following Compose project(s):"
    foreach ($p in $chosen) { Write-Host "  - $p" }
    $confirm = Read-Host "Type 'yes' to proceed"
    if ($confirm -ne 'yes') { Write-Host "Cancelled."; return }
  }

  foreach ($proj in $chosen) {
    Write-Host "Bringing down '$proj'..."
    $args = @('compose','-p',$proj,'down','-v','--remove-orphans')
    if ($PruneImages) { $args += '--rmi','local' }
    docker @args | Out-Null
    $defaultNet = "${proj}_default"
    docker network rm $defaultNet *> $null
    docker volume rm "${proj}_node_modules" *> $null
  }

  Write-Host "Done."
}

function Compose-Restart {
  param([switch]$production,[switch]$test,[switch]$empty,[string[]]$Services)

  $repoRoot = Resolve-Path "$PSScriptRoot/.."
  Set-Location $repoRoot

  $branch = Get-Branch
  $project = Get-Project

  Write-Host "Bringing down containers for '$branch'..."
  docker compose -p $project down -v --remove-orphans *> $null
  docker network rm "${project}_default" *> $null
  docker volume rm "${project}_node_modules" *> $null

  Compose-Up -production:$production -test:$test -empty:$empty -Services:$Services
}

switch ($Subcommand) {
  'up'      { Compose-Up -production:$production -test:$test -empty:$empty -Services:$Services }
  'down'    { Compose-Down -PruneImages:$PruneImages -Force:$Force }
  'restart' { Compose-Restart -production:$production -test:$test -empty:$empty -Services:$Services }
  default   { Show-Usage; exit 1 }
}
