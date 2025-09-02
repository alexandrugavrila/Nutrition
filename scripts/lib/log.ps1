# Shared PowerShell logging helpers
function Out-Step   { param([string]$m) Write-Host "» $m" -ForegroundColor Cyan }
function Out-Info   { param([string]$m) Write-Host $m }
function Out-Ok     { param([string]$m) Write-Host $m -ForegroundColor Green }
function Out-Warn   { param([string]$m) Write-Warning $m }
function Out-Err    { param([string]$m) Write-Error $m }
function Out-Result { param([string]$m,[string]$color='White') Write-Host "[RESULT] $m" -ForegroundColor $color }

