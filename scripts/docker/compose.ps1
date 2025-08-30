# scripts/docker/compose.ps1
[CmdletBinding()]
param(
  [Parameter(Position = 0, Mandatory = $true)]
  [ValidateSet('up','down','restart')]
  [string]$Command,

  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Services
)

function Show-Usage {
  Write-Host ""; Write-Host "Usage:" -ForegroundColor Yellow
  Write-Host "  pwsh ./scripts/docker/compose.ps1 <up|down|restart> [options]"
  Write-Host ""
  Write-Host "  up:      [type <-dev|-test>] data <-test|-prod> [service...]"
  Write-Host "  down:    [type <-dev|-test>]"
  Write-Host "  restart: [type <-dev|-test>] data <-test|-prod>"
  Write-Host ""
}

. "$PSScriptRoot/../lib/branch-env.ps1"
$envInfo = Set-BranchEnv

# If COMPOSE_ENV_FILE is set, write resolved ports for downstream scripts
if ($env:COMPOSE_ENV_FILE) {
  @(
    "DEV_DB_PORT=$env:DEV_DB_PORT",
    "DEV_BACKEND_PORT=$env:DEV_BACKEND_PORT",
    "DEV_FRONTEND_PORT=$env:DEV_FRONTEND_PORT",
    "TEST_DB_PORT=$env:TEST_DB_PORT",
    "TEST_BACKEND_PORT=$env:TEST_BACKEND_PORT",
    "TEST_FRONTEND_PORT=$env:TEST_FRONTEND_PORT"
  ) | Set-Content -Path $env:COMPOSE_ENV_FILE
}

Set-Location $envInfo.RepoRoot

function Invoke-Up {
  # Parse tokenized syntax in $Services: optional "type -test|-dev" and
  # required "data -test|-prod". Remove consumed tokens from $Services.
  $useTestPorts = $false
  $dataMode = $null
  if ($Services -and $Services.Count -gt 0) {
    $parsed = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $Services.Count; $i++) {
      $tok = $Services[$i]
      if ($tok -eq 'type' -and ($i + 1) -lt $Services.Count) {
        $val = $Services[$i + 1]
        if ($val -eq '-test') { $useTestPorts = $true; $i++; continue }
        elseif ($val -eq '-dev') { $useTestPorts = $false; $i++; continue }
        else { Write-Error "Invalid value for 'type'. Expected -test or -dev"; exit 1 }
      } elseif ($tok -eq 'data' -and ($i + 1) -lt $Services.Count) {
        $val = $Services[$i + 1]
        if ($val -eq '-test' -or $val -eq '-prod') { $dataMode = $val; $i++; continue }
        else { Write-Error "Invalid value for 'data'. Expected -test or -prod"; exit 1 }
      } else {
        [void]$parsed.Add($tok)
      }
    }
    $Services = $parsed.ToArray()
  }

  if (-not $dataMode) { Write-Error "Missing required 'data' selection. Usage: up [type <-dev|-test>] data <-test|-prod>"; exit 1 }

  # Resolve compose project name. Allow override via -Project; otherwise
  # when -UseTestPorts is set, suffix "-test" to isolate from the dev stack.
  $proj = if ($useTestPorts) { "$($envInfo.Project)-test" } else { $envInfo.Project }

  # Preserve current environment, optionally remap to TEST values only for the
  # duration of this 'up' call.
  $origEnv = @{
    DEV_DB_PORT = $env:DEV_DB_PORT
    DEV_BACKEND_PORT = $env:DEV_BACKEND_PORT
    DEV_FRONTEND_PORT = $env:DEV_FRONTEND_PORT
    DATABASE_URL = $env:DATABASE_URL
  }

  try {
    if ($useTestPorts) {
      $env:DEV_DB_PORT = $env:TEST_DB_PORT
      $env:DEV_BACKEND_PORT = $env:TEST_BACKEND_PORT
      $env:DEV_FRONTEND_PORT = $env:TEST_FRONTEND_PORT
      $env:DATABASE_URL = "postgresql://nutrition_user:nutrition_pass@localhost:$($env:DEV_DB_PORT)/nutrition"
    }

    Write-Host "Starting '$($envInfo.Branch)' as project '$proj' with ports:`n  DB: $env:DEV_DB_PORT`n  Backend: $env:DEV_BACKEND_PORT`n  Frontend: $env:DEV_FRONTEND_PORT"

    try {
      docker compose -p $proj up -d @Services
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
    docker compose -p $proj exec -T db pg_isready -U nutrition_user -d nutrition | Out-Null
  } until ($LASTEXITCODE -eq 0 -or (Get-Date) -ge $deadline)
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Database did not become ready within the timeout."
    exit 1
  }

  Write-Host "Waiting for backend dependencies (alembic) to be ready..."
  $deadline = (Get-Date).AddMinutes(3)
  do {
    Start-Sleep -Seconds 1
    docker compose -p $proj exec -T backend sh -lc "python -m pip show alembic >/dev/null 2>&1"
  } until ($LASTEXITCODE -eq 0 -or (Get-Date) -ge $deadline)
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Backend did not finish installing dependencies (alembic not available) within timeout."
    exit 1
  }

    Write-Host "Applying database migrations..."
    docker compose -p $proj exec -T backend python -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
      Write-Error "Database migration failed with exit code $LASTEXITCODE."
      exit $LASTEXITCODE
    }

    & "$PSScriptRoot/../env/activate-venv.ps1"
    if ($dataMode -eq '-prod') {
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

    Write-Host "Done." -ForegroundColor Green
  }
  finally {
    # Restore prior environment values so caller shells aren't polluted
    foreach ($k in $origEnv.Keys) {
      $v = $origEnv[$k]
      if ($null -eq $v) { Remove-Item "Env:$k" -ErrorAction SilentlyContinue }
      else { Set-Item "Env:$k" -Value $v }
    }
  }
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
  # Parse optional tokenized arguments from $Services: allow "type -test|-dev"
  $useTestPorts = $false
  if ($Services -and $Services.Count -gt 0) {
    $parsed = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt $Services.Count; $i++) {
      $tok = $Services[$i]
      if ($tok -eq 'type' -and ($i + 1) -lt $Services.Count) {
        $val = $Services[$i + 1]
        if ($val -eq '-test') { $useTestPorts = $true; $i++; continue }
        elseif ($val -eq '-dev') { $useTestPorts = $false; $i++; continue }
        else { Write-Error "Invalid value for 'type'. Expected -test or -dev"; return }
      } else {
        [void]$parsed.Add($tok)
      }
    }
    $Services = $parsed.ToArray()
  }

  $chosen = @()
  $proj = if ($useTestPorts) { "$($envInfo.Project)-test" } else { $envInfo.Project }
  Write-Host "Bringing down '$proj'..." -ForegroundColor Cyan
  docker compose -p $proj down -v --remove-orphans | Out-Null
  docker network rm "${proj}_default" 2>$null | Out-Null
  docker volume rm "${proj}_node_modules" 2>$null | Out-Null
  Write-Host "Done." -ForegroundColor Green
}

function Invoke-Restart {
  # Parse but do not remove tokens from $Services: require data, optional type
  $useTestPorts = $false
  $dataMode = $null
  if ($Services -and $Services.Count -gt 0) {
    for ($i = 0; $i -lt $Services.Count; $i++) {
      $tok = $Services[$i]
      if ($tok -eq 'type' -and ($i + 1) -lt $Services.Count) {
        $val = $Services[$i + 1]
        if ($val -eq '-test') { $useTestPorts = $true }
        elseif ($val -eq '-dev') { $useTestPorts = $false }
        else { Write-Error "Invalid value for 'type'. Expected -test or -dev"; return }
      } elseif ($tok -eq 'data' -and ($i + 1) -lt $Services.Count) {
        $val = $Services[$i + 1]
        if ($val -eq '-test' -or $val -eq '-prod') { $dataMode = $val }
        else { Write-Error "Invalid value for 'data'. Expected -test or -prod"; return }
      }
    }
  }
  if (-not $dataMode) { Write-Error "restart requires: data <-test|-prod> (optionally type <-dev|-test>)"; return }

  $proj = if ($useTestPorts) { "$($envInfo.Project)-test" } else { $envInfo.Project }
  Write-Host "Bringing down containers for project '$proj'..." -ForegroundColor Cyan
  docker compose -p $proj down -v --remove-orphans | Out-Null
  docker network rm "${proj}_default" 2>$null | Out-Null
  docker volume rm "${proj}_node_modules" 2>$null | Out-Null
  Invoke-Up
}

switch ($Command) {
  'up' { Invoke-Up }
  'down' { Invoke-Down }
  'restart' { Invoke-Restart }
  default { Show-Usage; exit 1 }
}
