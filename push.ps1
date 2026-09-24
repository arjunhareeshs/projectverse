# Build and push the three ProjectVerse images (server, client, edge) for a release — Windows equivalent of push.sh.
#
#   .\push.ps1                # version from VERSION -> tags v<VERSION>, sha-<commit>, latest
#   .\push.ps1 -Version 1.1.1
#   .\push.ps1 -NoPush        # build locally only
#
# Env: DOCKERHUB_USER (default pcdpbit), VITE_GOOGLE_CLIENT_ID (else read from docker\.env),
#      PUBLIC_BASE_PATH (default /verse). Switches: -AllowDirty, -Force (re-push an existing version tag).
param(
    [string]$Version = "",
    [switch]$NoPush,
    [switch]$AllowDirty,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $Version) { $Version = (Get-Content (Join-Path $PSScriptRoot "VERSION") -Raw).Trim() }
$Version = $Version.TrimStart("v")
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Version '$Version' is not X.Y.Z" }
$Tag = "v$Version"

$DockerHubUser = if ($env:DOCKERHUB_USER) { $env:DOCKERHUB_USER } else { "pcdpbit" }
$BasePath = if ($env:PUBLIC_BASE_PATH) { $env:PUBLIC_BASE_PATH } else { "/verse" }

function Get-EnvValue([string]$Key) {
    foreach ($file in @("docker\.env", ".env")) {
        if (-not (Test-Path $file)) { continue }
        $line = Get-Content $file | Where-Object { $_ -match "^$Key=" } | Select-Object -Last 1
        if ($line) {
            $value = ($line -split "=", 2)[1] -replace '\s+#.*$', '' -replace '^["'']|["'']$', ''
            if ($value) { return $value }
        }
    }
    return ""
}
$GoogleClientId = if ($env:VITE_GOOGLE_CLIENT_ID) { $env:VITE_GOOGLE_CLIENT_ID } else { Get-EnvValue "VITE_GOOGLE_CLIENT_ID" }

if (-not $NoPush -and (git status --porcelain) -and -not $AllowDirty) {
    git status -s
    throw "Uncommitted changes - a pushed image must match a commit. Commit first, or pass -AllowDirty."
}
$GitSha = (git rev-parse --short=12 HEAD).Trim()

if (-not $NoPush -and -not $Force) {
    docker manifest inspect "$DockerHubUser/projectverse-server:$Tag" *> $null
    if ($LASTEXITCODE -eq 0) {
        throw "$DockerHubUser/projectverse-server:$Tag already exists. Bump VERSION (released tags stay immutable), or pass -Force."
    }
}

if (-not $GoogleClientId) { Write-Warning "VITE_GOOGLE_CLIENT_ID is empty - Google sign-in will be disabled in this build." }

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " ProjectVerse release"
Write-Host " Registry : $DockerHubUser"
Write-Host " Version  : $Tag   (sha-$GitSha)"
Write-Host " Base path: $BasePath"
Write-Host " Mode     : $(if ($NoPush) { 'build only (local)' } else { 'build + push (linux/amd64)' })"
Write-Host "==========================================" -ForegroundColor Cyan

function Build-Image([string]$Name, [string]$Dockerfile, [string[]]$Extra = @()) {
    $repo = "$DockerHubUser/projectverse-$Name"
    Write-Host "`n--> projectverse-$Name" -ForegroundColor Yellow
    $mode = if ($NoPush) { "--load" } else { "--push" }
    docker buildx build --platform linux/amd64 -f $Dockerfile @Extra `
        -t "${repo}:$Tag" -t "${repo}:sha-$GitSha" -t "${repo}:latest" $mode .
    if ($LASTEXITCODE -ne 0) { throw "Build failed for projectverse-$Name" }
}

Build-Image "server" "docker/Dockerfile.server"
Build-Image "client" "docker/Dockerfile.client" @("--build-arg", "VITE_BASE_PATH=$BasePath", "--build-arg", "VITE_GOOGLE_CLIENT_ID=$GoogleClientId")
Build-Image "edge" "docker/Dockerfile.edge"

Write-Host "`n==========================================" -ForegroundColor Green
if ($NoPush) {
    Write-Host " Built locally: $DockerHubUser/projectverse-{server,client,edge}:$Tag (not pushed)"
} else {
    Write-Host " Pushed $DockerHubUser/projectverse-{server,client,edge}:$Tag"
    Write-Host ""
    Write-Host " On the server:"
    Write-Host "   1. set IMG_TAG=$Tag in docker/.env"
    Write-Host "   2. ./deploy.sh            (first deploy on a fresh DB: ./deploy.sh --seed)"
}
Write-Host "==========================================" -ForegroundColor Green
