# scripts/compose-up-branch.ps1
[CmdletBinding()]
param(
  # Optional: restrict to specific services, e.g. "backend frontend"
  [Parameter(ValueFromRemainingArguments=$true)]
  [string[]]$Services
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Ensure git is available
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw "git not found in PATH."
}

# Resolve repo root (folder that contains docker-compose.yml)
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $repoRoot 'docker-compose.yml'))) {
  throw "docker-compose.yml not found at $repoRoot"
}

# Get current branch and sanitize for docker compose project name
$branch = (git -C $repoRoot rev-parse --abbrev-ref HEAD).Trim()
if ([string]::IsNullOrWhiteSpace($branch)) { throw "Could not determine git branch." }

$sanitized = ($branch.ToLower() -replace '[^a-z0-9]', '-').Trim('-')
if ([string]::IsNullOrWhiteSpace($sanitized)) { $sanitized = 'default' }

Write-Host "Starting containers for branch: $branch (sanitized: $sanitized)"

# Run docker compose
Push-Location $repoRoot
try {
  if ($Services -and $Services.Count -gt 0) {
    docker compose -p "nutrition-$sanitized" up -d @Services
  } else {
    docker compose -p "nutrition-$sanitized" up -d
  }
}
finally {
  Pop-Location
}
