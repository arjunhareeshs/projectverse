# Kept for existing habits — the release pipeline lives in ..\push.ps1 (server, client and edge images).
& (Join-Path (Split-Path -Parent $PSScriptRoot) "push.ps1") @args
exit $LASTEXITCODE
