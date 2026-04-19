<#
.SYNOPSIS
    Build and publish immutable backend/frontend images for a release tag.

.DESCRIPTION
    Reads registry credentials and image repositories from environment variables,
    `.env.publish`, or `.env`, shows the latest 3 local git tags as release
    hints, optionally prompts for a new tag, then builds and pushes the backend
    and frontend images using the same Dockerfiles used by CI.

.PARAMETER Tag
    Release tag to publish. If omitted, the script shows the latest 3 local git
    tags and prompts interactively.

.PARAMETER CreateGitTag
    Create an annotated git tag matching the published image tag after push.

.PARAMETER PushGitTag
    Push the matching git tag to origin after publish. Implies a local git tag
    exists; if it does not, one is created first.
#>
[CmdletBinding()]
param(
  [string]$Tag,
  [switch]$CreateGitTag,
  [switch]$PushGitTag
)

$ErrorActionPreference = 'Stop'

. "$PSScriptRoot/../lib/publish-utils.ps1"

$repoRoot = Get-PublishRepoRoot
Set-Location $repoRoot

$resolvedTag = Resolve-ReleaseTag -Tag $Tag
$images = Get-PublishImageReferences -Tag $resolvedTag

Write-Host "Publishing release tag '$resolvedTag'"
Write-Host "  Backend:  $($images.BackendImage)"
Write-Host "  Frontend: $($images.FrontendImage)"

Invoke-RegistryLogin -Registry $images.Registry
Invoke-PublishBuild -Images $images
Invoke-PublishPush -Images $images

if ($CreateGitTag -or $PushGitTag) {
  Ensure-ReleaseGitTag -Tag $resolvedTag -Push:$PushGitTag
}

Write-Host "Publish complete."
Write-Host "Next deploy command:"
Write-Host "  pwsh ./scripts/prod/deploy.ps1 -Tag $resolvedTag"
