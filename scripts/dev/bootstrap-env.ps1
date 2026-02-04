param(
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function CopyEnvIfMissing([string]$examplePath, [string]$targetPath, [bool]$force) {
  if (-not (Test-Path $examplePath)) {
    Write-Host "[WARN] Missing example: $examplePath" -ForegroundColor Yellow
    return
  }

  if ((Test-Path $targetPath) -and (-not $force)) {
    Write-Host "[OK] Exists: $targetPath" -ForegroundColor Green
    return
  }

  if ((Test-Path $targetPath) -and $force) {
    Write-Host "[WARN] Overwriting: $targetPath" -ForegroundColor Yellow
  } else {
    Write-Host "[OK] Creating: $targetPath" -ForegroundColor Green
  }

  Copy-Item -Force:$force -Path $examplePath -Destination $targetPath
}

Write-Host "Bootstrap env files (.env)" -ForegroundColor Cyan
Write-Host "Force overwrite: $Force"
Write-Host ""

CopyEnvIfMissing "apps/backend/.env.example" "apps/backend/.env" $Force
CopyEnvIfMissing "apps/mobile/.env.example" "apps/mobile/.env" $Force

Write-Host ""
Write-Host "Done."

