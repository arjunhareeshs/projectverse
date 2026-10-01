param(
    [string]$Version = (Get-Content (Join-Path $PSScriptRoot "VERSION") -Raw).Trim(),
    [string]$DockerHubUser = $env:DOCKERHUB_USER,
    [string]$GoogleClientId = $env:VITE_GOOGLE_CLIENT_ID
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $DockerHubUser) {
    $DockerHubUser = "pcdpbit"
}

if (-not $Version) {
    throw "Version is required. Set it with -Version or add a value to VERSION."
}

$Version = "v" + $Version.TrimStart("v")
$env:VERSION = $Version

# Client build config comes from the env file (docker/.env.production, else root .env).
function Get-EnvValue([string]$Key) {
    foreach ($f in @("docker/.env.production", ".env")) {
        if (Test-Path $f) {
            $line = Select-String -Path $f -Pattern "^$Key=" | Select-Object -First 1
            if ($line) { return ($line.Line -replace "^$Key=", "" -replace "\s+#.*$", "").Trim().Trim('"') }
        }
    }
    return ""
}
if (-not $GoogleClientId) { $GoogleClientId = Get-EnvValue "VITE_GOOGLE_CLIENT_ID" }
if (-not $GoogleClientId) { throw "VITE_GOOGLE_CLIENT_ID not found in docker/.env.production or .env" }
$BasePath = Get-EnvValue "PUBLIC_BASE_PATH"; if (-not $BasePath) { $BasePath = "/verse" }
$env:DOCKERHUB_USER = $DockerHubUser

function Push-WithRetry([string]$Image) {
    for ($n = 1; $n -le 5; $n++) {
        docker push $Image
        if ($LASTEXITCODE -eq 0) { return }
        Write-Warning "Push of $Image failed (attempt $n/5); retrying..."
        Start-Sleep -Seconds (10 * $n)
    }
    throw "Push of $Image failed after 5 attempts."
}

docker build `
    --build-arg VITE_GOOGLE_CLIENT_ID="$GoogleClientId" `
    --build-arg VITE_BASE_PATH="$BasePath" `
    -t projectverse-client:$env:VERSION `
    -f .\docker\Dockerfile.client .

docker tag projectverse-client:$env:VERSION $env:DOCKERHUB_USER/projectverse-client:$env:VERSION
Push-WithRetry "$env:DOCKERHUB_USER/projectverse-client:$env:VERSION"

docker build -t projectverse-server:$env:VERSION -f .\docker\Dockerfile.server .
docker tag projectverse-server:$env:VERSION $env:DOCKERHUB_USER/projectverse-server:$env:VERSION
Push-WithRetry "$env:DOCKERHUB_USER/projectverse-server:$env:VERSION"

docker build -t projectverse-edge:$env:VERSION -f .\docker\Dockerfile.edge .
docker tag projectverse-edge:$env:VERSION $env:DOCKERHUB_USER/projectverse-edge:$env:VERSION
Push-WithRetry "$env:DOCKERHUB_USER/projectverse-edge:$env:VERSION"