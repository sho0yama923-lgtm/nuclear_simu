param(
  [Parameter(Mandatory = $true)]
  [string]$FebFile,

  [string]$FebioExe = "",

  [string]$OutputDir = "",

  [string[]]$ExtraArgs = @(),

  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Resolve-FebioExecutable {
  param(
    [string]$ExplicitPath
  )

  $candidates = @(
    $ExplicitPath,
    $env:FEBIO_EXE,
    $env:FEBIO_CMD,
    "C:\Program Files\FEBioStudio2\bin\febio4.exe",
    "C:\Program Files\FEBioStudio\bin\febio4.exe",
    "C:\Program Files\FEBio Suite 4\bin\febio4.exe",
    "C:\Program Files\FEBioSuite2\bin\febio4.exe"
  ) | Where-Object { $_ }

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  $command = Get-Command febio4,febio3,febio -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($command) {
    return $command.Source
  }

  throw "FEBio executable was not found. Pass -FebioExe or set FEBIO_EXE."
}

$resolvedFebFile = (Resolve-Path -LiteralPath $FebFile).Path
$resolvedExe = Resolve-FebioExecutable -ExplicitPath $FebioExe
$caseStem = [System.IO.Path]::GetFileNameWithoutExtension($resolvedFebFile)

if (-not $OutputDir) {
  $OutputDir = Join-Path (Split-Path -Parent $resolvedFebFile) ("febio_runs\" + $caseStem)
}

$resolvedOutputDir = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

$workingFebFile = Join-Path $resolvedOutputDir ([System.IO.Path]::GetFileName($resolvedFebFile))
if ($workingFebFile -ne $resolvedFebFile) {
  Copy-Item -LiteralPath $resolvedFebFile -Destination $workingFebFile -Force
}

$inputJsonName = "febio_" + $caseStem + "_input.json"
$sourceInputJson = Join-Path (Split-Path -Parent $resolvedFebFile) $inputJsonName
$workingInputJson = Join-Path $resolvedOutputDir $inputJsonName
if (Test-Path -LiteralPath $sourceInputJson) {
  Copy-Item -LiteralPath $sourceInputJson -Destination $workingInputJson -Force
}

$cliLogPath = Join-Path $resolvedOutputDir ($caseStem + "_cli.log")
$arguments = @("-i", $workingFebFile) + $ExtraArgs

Write-Host "FEBio executable : $resolvedExe"
Write-Host "Input .feb       : $workingFebFile"
Write-Host "Output directory : $resolvedOutputDir"
Write-Host "Command          : $resolvedExe $($arguments -join ' ')"

if ($DryRun) {
  Write-Host "DryRun requested. Command was not executed."
  exit 0
}

Push-Location $resolvedOutputDir
try {
  & $resolvedExe @arguments 2>&1 | Tee-Object -FilePath $cliLogPath
  if ($LASTEXITCODE -ne 0) {
    throw "FEBio exited with code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

if (Test-Path -LiteralPath $workingInputJson) {
  $convertScript = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "convert_febio_output.mjs"
  $resultJsonPath = Join-Path $resolvedOutputDir ($caseStem + "_result.json")
  & node $convertScript --run-dir $resolvedOutputDir --input-json $workingInputJson --out-file $resultJsonPath
  if ($LASTEXITCODE -ne 0) {
    throw "FEBio post-processing failed with code $LASTEXITCODE"
  }
  Write-Host "Result JSON      : $resultJsonPath"
}
else {
  Write-Warning "Companion FEBio input JSON was not found. Skipped result JSON conversion."
}

Write-Host "Completed successfully."
Write-Host "CLI log file     : $cliLogPath"
