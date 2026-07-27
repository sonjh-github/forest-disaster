$ErrorActionPreference = "Stop"

$adapterRoot = Split-Path -Parent $PSScriptRoot
$healthUrl = "http://127.0.0.1:18890/health"

try {
  $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
  if ($health.service -eq "forest-gcs-adapter") {
    Write-Output "Drone hardware instance is already running: $healthUrl"
    exit 0
  }
} catch {
  # The dedicated instance is not running yet.
}

Push-Location $adapterRoot
try {
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "Build failed with exit code $LASTEXITCODE"
  }

  $nodePath = (Get-Command node.exe).Source
  $processInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $processInfo.FileName = $nodePath
  $processInfo.Arguments = "--env-file=.env.instance dist/src/index.js"
  $processInfo.WorkingDirectory = $adapterRoot
  $processInfo.UseShellExecute = $false
  $processInfo.CreateNoWindow = $true
  $processInfo.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $process = [System.Diagnostics.Process]::Start($processInfo)

  Start-Sleep -Seconds 2
  $health = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
  Write-Output "Drone hardware instance started. PID=$($process.Id), HTTP=$($health.instance.port), MAVLink UDP=$($health.instance.mavlinkPort)"
} finally {
  Pop-Location
}
