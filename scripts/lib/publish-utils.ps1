# Shared helpers for manually building and publishing immutable application images.

$script:PublishEnvCandidates = @('.env.publish', '.env')

function Get-PublishRepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
}

function Get-PublishEnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Key,

    [switch]$Optional
  )

  $envItem = Get-Item -Path "Env:$Key" -ErrorAction SilentlyContinue
  if ($envItem -and -not [string]::IsNullOrWhiteSpace($envItem.Value)) {
    return $envItem.Value
  }

  foreach ($candidate in $script:PublishEnvCandidates) {
    $path = Join-Path (Get-PublishRepoRoot) $candidate
    if (-not (Test-Path $path)) { continue }

    $pattern = '^\s*' + [regex]::Escape($Key) + '=(.*)$'
    foreach ($line in Get-Content -Path $path) {
      if ($line -match $pattern) {
        return $Matches[1]
      }
    }
  }

  if ($Optional) {
    return $null
  }

  throw "Required setting '$Key' was not found in the environment, .env.publish, or .env."
}

function Get-RecentReleaseTags {
  param([int]$Count = 3)

  try {
    $tags = & git -C (Get-PublishRepoRoot) tag --sort=-creatordate 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $tags) {
      return @()
    }
    return @($tags | Select-Object -First $Count)
  }
  catch {
    return @()
  }
}

function Test-PublishInteractive {
  try {
    return (-not [Console]::IsInputRedirected) -and (-not [Console]::IsOutputRedirected)
  }
  catch {
    return $false
  }
}

function Resolve-ReleaseTag {
  param([string]$Tag)

  if ($Tag) {
    return $Tag.Trim()
  }

  $recent = Get-RecentReleaseTags
  if ($recent.Count -gt 0) {
    Write-Host "Latest 3 release tags:"
    foreach ($existing in $recent) {
      Write-Host "  $existing"
    }
  }
  else {
    Write-Host "No existing git tags were found in this repository."
  }

  if (-not (Test-PublishInteractive)) {
    throw "No tag was provided and the shell is non-interactive. Supply -Tag explicitly."
  }

  $inputTag = Read-Host 'Enter the new image tag to publish'
  if ([string]::IsNullOrWhiteSpace($inputTag)) {
    throw "A non-empty tag is required."
  }

  return $inputTag.Trim()
}

function Get-RegistryHost {
  param([Parameter(Mandatory = $true)][string]$ImageRepository)

  $configured = Get-PublishEnvValue -Key 'CONTAINER_REGISTRY' -Optional
  if ($configured) {
    return $configured
  }

  $firstSegment = ($ImageRepository -split '/', 2)[0]
  if ($firstSegment -match '[\.:]' -or $firstSegment -eq 'localhost') {
    return $firstSegment
  }

  return 'docker.io'
}

function Get-PublishImageReferences {
  param([Parameter(Mandatory = $true)][string]$Tag)

  $backendRepo = Get-PublishEnvValue -Key 'BACKEND_IMAGE_REPO'
  $frontendRepo = Get-PublishEnvValue -Key 'FRONTEND_IMAGE_REPO'

  return [pscustomobject]@{
    BackendRepository = $backendRepo
    FrontendRepository = $frontendRepo
    BackendImage = "$backendRepo`:$Tag"
    FrontendImage = "$frontendRepo`:$Tag"
    Registry = Get-RegistryHost -ImageRepository $backendRepo
  }
}

function Invoke-RegistryLogin {
  param([Parameter(Mandatory = $true)][string]$Registry)

  $username = Get-PublishEnvValue -Key 'CONTAINER_REGISTRY_USERNAME'
  $token = Get-PublishEnvValue -Key 'CONTAINER_REGISTRY_TOKEN'

  Write-Host "Logging into container registry '$Registry'..."
  $token | docker login $Registry --username $username --password-stdin
  if ($LASTEXITCODE -ne 0) {
    throw "docker login failed."
  }
}

function Invoke-PublishBuild {
  param([Parameter(Mandatory = $true)]$Images)

  $repoRoot = Get-PublishRepoRoot
  Push-Location $repoRoot
  try {
    Write-Host "Building backend image: $($Images.BackendImage)"
    & docker build -f Backend/Dockerfile --target prod -t $Images.BackendImage .
    if ($LASTEXITCODE -ne 0) { throw "Backend image build failed." }

    Write-Host "Building frontend image: $($Images.FrontendImage)"
    & docker build -f Frontend/Dockerfile -t $Images.FrontendImage .
    if ($LASTEXITCODE -ne 0) { throw "Frontend image build failed." }
  }
  finally {
    Pop-Location
  }
}

function Invoke-PublishPush {
  param([Parameter(Mandatory = $true)]$Images)

  Write-Host "Pushing backend image: $($Images.BackendImage)"
  & docker push $Images.BackendImage
  if ($LASTEXITCODE -ne 0) { throw "Backend image push failed." }

  Write-Host "Pushing frontend image: $($Images.FrontendImage)"
  & docker push $Images.FrontendImage
  if ($LASTEXITCODE -ne 0) { throw "Frontend image push failed." }
}

function Ensure-ReleaseGitTag {
  param(
    [Parameter(Mandatory = $true)][string]$Tag,
    [switch]$Push
  )

  $repoRoot = Get-PublishRepoRoot
  $exists = (& git -C $repoRoot tag --list $Tag 2>$null | Out-String).Trim()
  if (-not $exists) {
    Write-Host "Creating annotated git tag '$Tag'..."
    & git -C $repoRoot tag -a $Tag -m "Release $Tag"
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to create git tag '$Tag'."
    }
  }
  else {
    Write-Host "Git tag '$Tag' already exists locally."
  }

  if ($Push) {
    Write-Host "Pushing git tag '$Tag' to origin..."
    & git -C $repoRoot push origin $Tag
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to push git tag '$Tag' to origin."
    }
  }
}
