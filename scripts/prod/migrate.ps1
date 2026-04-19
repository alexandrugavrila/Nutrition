<#
.SYNOPSIS
    Run Alembic migrations against the production compose stack.

.DESCRIPTION
    Starts the production database service if needed, waits for it to become
    healthy, then runs `alembic upgrade head` through a one-off backend
    container using docker-compose.prod.yml and .env.production.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

. "$PSScriptRoot/../lib/prod-compose.ps1"

$repoRoot = Get-ProdRepoRoot
Set-Location $repoRoot

Write-Host "Ensuring the production database service is running..."
Invoke-ProdCompose -Arguments @('up', '-d', 'db')
Wait-ProdService -Service 'db' -TimeoutSeconds 180

Invoke-ProdMigration

Write-Host "Production migrations complete."
