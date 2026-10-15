$ErrorActionPreference = 'Stop'
$taskFolder = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskNode = (Get-Command node -ErrorAction Stop).Source
$taskConnection = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
if (-not $taskConnection) {
    Start-Process -FilePath $taskNode -ArgumentList 'server.mjs' -WorkingDirectory $taskFolder -WindowStyle Hidden
    Start-Sleep -Seconds 1
}
Start-Process 'http://localhost:4173'
