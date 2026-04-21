param(
  [int]$Port = 8765,
  [string]$BridgeHost = "127.0.0.1",
  [string]$FebioExe = "",
  [switch]$OpenApp
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptRoot "..")

$nodeArgs = @(
  (Join-Path $scriptRoot "febio_bridge_server.mjs"),
  "--host", $BridgeHost,
  "--port", $Port
)

if ($FebioExe) {
  $nodeArgs += @("--febio-exe", $FebioExe)
}

Push-Location $projectRoot
try {
  if ($OpenApp) {
    Start-Process "http://$BridgeHost`:$Port/"
  }
  & node @nodeArgs
}
finally {
  Pop-Location
}
