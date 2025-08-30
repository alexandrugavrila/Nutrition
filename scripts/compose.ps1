# scripts/compose.ps1
[CmdletBinding()]
param(
  [Parameter(Position = 0, Mandatory = $true)]
  [ValidateSet('up','down','restart')]
  [string]$Command,

  [switch]$production,
  [switch]$test,
  [switch]$empty,
  [switch]$PruneImages,
  [switch]$Force,
  [switch]$All,
  [string]$Project,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Services
)

function Show-Usage {
  Write-Host ""; Write-Host "Usage:" -ForegroundColor Yellow
  Write-Host "  pwsh ./scripts/compose.ps1 <up|down|restart> [options]"
  Write-Host ""
  Write-Host "  down options: --All | --Project <name> | -PruneImages | -Force"
  Write-Host ""
}

. "$PSScriptRoot/lib/branch-env.ps1"
$envInfo = Set-BranchEnv

# If COMPOSE_ENV_FILE is set, write resolved ports for downstream scripts
if ($env:COMPOSE_ENV_FILE) {
  @(
    "DB_PORT=$env:DB_PORT",
    "BACKEND_PORT=$env:BACKEND_PORT",
    "FRONTEND_PORT=$env:FRONTEND_PORT"
  ) | Set-Content -Path $env:COMPOSE_ENV_FILE
}

Set-Location $envInfo.RepoRoot

function Invoke-Up {
  $modeCount = @($production,$test,$empty) | Where-Object { $_ } | Measure-Object | Select-Object -ExpandProperty Count
  if ($modeCount -ne 1) {
    Write-Error "You must specify exactly one of: -production, -test, or -empty."
    exit 1
  }

  Write-Host "Starting '$($envInfo.Branch)' with ports:`n  DB: $env:DB_PORT`n  Backend: $env:BACKEND_PORT`n  Frontend: $env:FRONTEND_PORT"

  try {
    docker compose -p $envInfo.Project up -d @Services
    if ($LASTEXITCODE -ne 0) { throw "docker compose exited with code $LASTEXITCODE" }
  } catch {
    Write-Error "Failed to start services: $_"
    exit 1
  }

  if ($empty) {
    Write-Host "Starting with empty database."
    return
  }

  Write-Host "Waiting for database to be ready..."
  $deadline = (Get-Date).AddMinutes(2)
  do {
    Start-Sleep -Seconds 1
    docker compose -p $envInfo.Project exec -T db pg_isready -U nutrition_user -d nutrition | Out-Null
  } until ($LASTEXITCODE -eq 0 -or (Get-Date) -ge $deadline)
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Database did not become ready within the timeout."
    exit 1
  }

  Write-Host "Waiting for backend dependencies (alembic) to be ready..."
  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 1
    docker compose -p $envInfo.Project exec -T backend sh -lc "python -m pip show alembic >/dev/null 2>&1"
  } until ($LASTEXITCODE -eq 0 -or (Get-Date) -ge $deadline)
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend did not finish installing dependencies (alembic not available) within timeout."
    exit 1
  }

  Write-Host "Applying database migrations..."
  docker compose -p $envInfo.Project exec -T backend python -m alembic upgrade head
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Database migration failed with exit code $LASTEXITCODE."
    exit $LASTEXITCODE
  }

  if ($production -or $test) {
    & "$PSScriptRoot/activate-venv.ps1"
    if ($production) {
      Write-Host "Importing production data..."
      & python Database/import_from_csv.py --production
    } else {
      Write-Host "Importing test data..."
      & python Database/import_from_csv.py --test
    }
    if ($LASTEXITCODE -ne 0) {
      Write-Error "Data import failed with exit code $LASTEXITCODE."
      exit $LASTEXITCODE
    }
  }

  Write-Host "Done." -ForegroundColor Green
}

function Get-ComposeProjects([string]$Prefix = 'nutrition-') {
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
    $labelValues = docker ps -a --format '{{.Label "com.docker.compose.project"}}' 2>$null |
      Where-Object { $_ -and ($_ -like "$Prefix*") } |
      Sort-Object -Unique
    $projects = $labelValues
  }
  return $projects
}

function Prioritize-CurrentBranch([string[]]$Projects) {
  $currentProj = $envInfo.Project
  if ($currentProj -and $Projects -contains $currentProj) {
    return @($currentProj) + ($Projects | Where-Object { $_ -ne $currentProj })
  }
  return $Projects
}

function Select-Projects([string[]]$Projects) {
  if (-not $Projects -or $Projects.Count -eq 0) {
    Write-Host "No Compose projects found with the expected prefix." -ForegroundColor Yellow
    return @()
  }
  Write-Host "Select project(s) to delete:" -ForegroundColor Cyan
  for ($i = 0; $i -lt $Projects.Count; $i++) {
    Write-Host ("{0,2}) {1}" -f ($i+1), $Projects[$i])
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

function Invoke-Down {
  $chosen = @()
  if ($All) {
    $chosen = Get-ComposeProjects | Prioritize-CurrentBranch
    if (-not $chosen -or $chosen.Count -eq 0) { 
      Write-Host "No Compose projects found with the expected prefix." -ForegroundColor Yellow
      return
    }
  } elseif ($Project) {
    $chosen = @($Project)
  } else {
    $chosen = @($envInfo.Project)
  }

  if (-not $Force -and $chosen.Count -gt 1) {
    Write-Host "You are about to delete the following Compose project(s):" -ForegroundColor Yellow
    $chosen | ForEach-Object { Write-Host "  - $_" }
    $confirm = Read-Host "Type 'yes' to proceed"
    if ($confirm -ne 'yes') {
      Write-Host "Cancelled."
      return
    }
  }

  foreach ($proj in $chosen) {
    Write-Host "Bringing down '$proj'..." -ForegroundColor Cyan
    $args = @('compose','-p',$proj,'down','-v','--remove-orphans')
    if ($PruneImages) { $args += @('--rmi','local') }
    docker @args
    $defaultNet = "${proj}_default"
    docker network rm $defaultNet 2>$null | Out-Null
    docker volume rm "${proj}_node_modules" 2>$null | Out-Null
  }
  Write-Host "Done." -ForegroundColor Green
}

function Invoke-Restart {
  Write-Host "Bringing down containers for '$($envInfo.Branch)'..." -ForegroundColor Cyan
  docker compose -p $envInfo.Project down -v --remove-orphans | Out-Null
  docker network rm "${($envInfo.Project)}_default" 2>$null | Out-Null
  docker volume rm "${($envInfo.Project)}_node_modules" 2>$null | Out-Null
  Invoke-Up
}

switch ($Command) {
  'up' { Invoke-Up }
  'down' { Invoke-Down }
  'restart' { Invoke-Restart }
  default { Show-Usage; exit 1 }
}
