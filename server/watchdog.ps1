param([int]$MaxRestarts = 999, [int]$DelaySeconds = 2)

$serverDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$restarts = 0

function Clear-Port4000 {
    $portProc = (Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue).OwningProcess
    if ($portProc) {
        foreach ($p in $portProc) {
            if ($p -gt 4) {
                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
                Write-Host "[WATCHDOG] Cleared existing process $p on port 4000"
            }
        }
        Start-Sleep -Milliseconds 500
    }
}

Write-Host "[WATCHDOG] Starting ProjectVerse backend server..."
Clear-Port4000

while ($restarts -lt $MaxRestarts) {
    Write-Host "[WATCHDOG] Launch #$($restarts + 1) - $(Get-Date -Format 'HH:mm:ss')"
    
    $proc = Start-Process -FilePath "node" `
        -ArgumentList "dist/index.js" `
        -WorkingDirectory $serverDir `
        -NoNewWindow `
        -PassThru
    
    $proc.WaitForExit()
    $exitCode = $proc.ExitCode

    Write-Host "[WATCHDOG] Server exited with code $exitCode at $(Get-Date -Format 'HH:mm:ss')"

    if ($exitCode -eq 0) {
        Write-Host "[WATCHDOG] Clean exit. Stopping."
        break
    }

    $restarts++
    Write-Host "[WATCHDOG] Restarting in $DelaySeconds seconds... (restart $restarts of $MaxRestarts)"
    Start-Sleep -Seconds $DelaySeconds
    Clear-Port4000
}

Write-Host "[WATCHDOG] Watchdog stopped."
