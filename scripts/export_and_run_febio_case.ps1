param(
  [string]$CaseName = "C",
  [string]$OutputDir = "",
  [string]$FebioExe = "",
  [string]$ParamsFile = ""
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptRoot "..")

if (-not $OutputDir) {
  $OutputDir = Join-Path $projectRoot "febio_exports\$CaseName"
}

$exportArgs = @(
  (Join-Path $scriptRoot "export_febio_case.mjs"),
  "--case", $CaseName,
  "--out-dir", $OutputDir
)

if ($ParamsFile) {
  $exportArgs += @("--params", $ParamsFile)
}

& node @exportArgs

$febFile = Join-Path $OutputDir ("case_" + $CaseName.ToUpper() + ".feb")
$runArgs = @(
  "-ExecutionPolicy", "Bypass",
  "-File", (Join-Path $scriptRoot "run_febio_case.ps1"),
  "-FebFile", $febFile,
  "-OutputDir", (Join-Path $OutputDir "run")
)

if ($FebioExe) {
  $runArgs += @("-FebioExe", $FebioExe)
}

& powershell @runArgs
