# ProjectVerse Image Release & Tagging Script (PowerShell)
param(
    [Parameter(Position = 0)]
    [string]$DockerUser = $env:DOCKERHUB_USER,
    [switch]$AllowDirty = $false
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
Set-Location $RootDir

if (-not $DockerUser) {
    Write-Error "Docker username not specified. Usage: .\scripts\release.ps1 <dockerhub_username> or set `$env:DOCKERHUB_USER"
    exit 1
}

if (-not (Test-Path "VERSION")) {
    Write-Error "VERSION file not found at $RootDir\VERSION"
    exit 1
}

$Version = (Get-Content "VERSION" -Raw).Trim()

$gitStatus = git status --porcelain
if ($gitStatus -and -not $AllowDirty) {
    Write-Error "Working directory has uncommitted changes. Commit before releasing, or pass -AllowDirty."
    git status -s
    exit 1
}

$GitSha = (git rev-parse --short=12 HEAD).Trim()

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "ProjectVerse Release Pipeline" -ForegroundColor Cyan
Write-Host "Registry User : $DockerUser"
Write-Host "Version       : $Version"
Write-Host "Git SHA Tag   : sha-$GitSha"
Write-Host "Target Arch   : linux/amd64"
Write-Host "==========================================" -ForegroundColor Cyan

Write-Host "`n--> Building & pushing projectverse-server..." -ForegroundColor Yellow
docker buildx build --platform linux/amd64 `
  -f docker/Dockerfile.server `
  -t "$DockerUser/projectverse-server:$Version" `
  -t "$DockerUser/projectverse-server:sha-$GitSha" `
  -t "$DockerUser/projectverse-server:latest" `
  --push .

Write-Host "`n--> Building & pushing projectverse-client..." -ForegroundColor Yellow
$clientBuildArgs = @()
if ($env:VITE_GOOGLE_CLIENT_ID) {
    $clientBuildArgs += "--build-arg", "VITE_GOOGLE_CLIENT_ID=$($env:VITE_GOOGLE_CLIENT_ID)"
}

docker buildx build --platform linux/amd64 `
  -f docker/Dockerfile.client `
  @clientBuildArgs `
  -t "$DockerUser/projectverse-client:$Version" `
  -t "$DockerUser/projectverse-client:sha-$GitSha" `
  -t "$DockerUser/projectverse-client:latest" `
  --push .

Write-Host "`nImages successfully pushed to Docker Hub!" -ForegroundColor Green
Write-Host "To deploy with Docker Compose, configure docker/.env and run:"
Write-Host "  docker compose -f docker/docker-compose.yml up -d"
