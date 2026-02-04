param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"

function Section([string]$title) {
  Write-Host ""
  Write-Host ("== {0} ==" -f $title) -ForegroundColor Cyan
}

function Ok([string]$msg) { Write-Host ("[OK] {0}" -f $msg) -ForegroundColor Green }
function Warn([string]$msg) { Write-Host ("[WARN] {0}" -f $msg) -ForegroundColor Yellow }
function Err([string]$msg) { Write-Host ("[ERROR] {0}" -f $msg) -ForegroundColor Red }

function HasCommand([string]$name) {
  return $null -ne (Get-Command $name -ErrorAction SilentlyContinue)
}

function FileStatus([string]$path) {
  if (Test-Path $path) { Ok "$path exists" } else { Warn "$path missing" }
}

function CheckTcpPort([string]$hostname, [int]$port, [string]$label) {
  try {
    $res = Test-NetConnection -ComputerName $hostname -Port $port -InformationLevel Quiet
    if ($res) { Ok "$label reachable (${hostname}:$port)" } else { Warn "$label not reachable (${hostname}:$port)" }
  } catch {
    Warn "$label check failed (${hostname}:$port)"
  }
}

$fatal = $false

Section "Repo"
Ok ("Path: {0}" -f (Get-Location))

Section "Node/npm"
if (-not (HasCommand "node")) { Err "node not found in PATH"; $fatal = $true } else { Ok ("node: {0}" -f (& node -v)) }
if (-not (HasCommand "npm")) { Err "npm not found in PATH"; $fatal = $true } else { Ok ("npm: {0}" -f (& npm -v)) }

Section "Docker"
if (-not (HasCommand "docker")) {
  Err "docker not found in PATH"
  $fatal = $true
} else {
  try {
    $v = & docker version --format "{{.Server.Version}}" 2>$null
    if ($v) {
      Ok "docker server: $v"
    } else {
      Warn "docker is installed but server not reachable (is Docker Desktop running?)"
    }
  } catch {
    Warn "docker version check failed (is Docker Desktop running?)"
  }
}

Section ".env files"
FileStatus "apps/backend/.env"
FileStatus "apps/backend/.env.example"
FileStatus "apps/mobile/.env"
FileStatus "apps/mobile/.env.example"

Section "Infra ports (localhost)"
CheckTcpPort "localhost" 5432 "Postgres"
CheckTcpPort "localhost" 6379 "Redis"
CheckTcpPort "localhost" 9001 "MinIO Console"
CheckTcpPort "localhost" 8025 "Mailhog"
CheckTcpPort "localhost" 16686 "Jaeger"
CheckTcpPort "localhost" 3000 "Backend API (Fastify)"

Section "Android tooling (optional)"
if (HasCommand "adb") {
  try {
    $adbVer = (& adb version | Select-Object -First 1)
    Ok $adbVer
  } catch {
    Warn "adb present but version check failed"
  }
} else {
  Warn "adb not found (Android Studio / platform-tools)"
}

if ($env:ANDROID_SDK_ROOT -or $env:ANDROID_HOME) {
  $sdkRootEnv = $env:ANDROID_SDK_ROOT
  if (-not $sdkRootEnv) { $sdkRootEnv = $env:ANDROID_HOME }
  Ok ("ANDROID_SDK_ROOT/ANDROID_HOME set: {0}" -f $sdkRootEnv)
} else {
  Warn "ANDROID_SDK_ROOT not set (tasks will try default LOCALAPPDATA\\Android\\Sdk)"
}

Section "Next steps"
Write-Host "- VS Code: Dev: Full stack (Seed Prompt pro+disclaimer + Dashboards)"
Write-Host "- If iPhone device: Dev: Show LAN IP (for iOS device)"
Write-Host "- If emulator: Android: Start Emulator (first AVD)"

if ($fatal) {
  Write-Host ""
  Err "Dev Doctor found fatal issues (see above)."
  exit 1
}

Write-Host ""
Ok "Dev Doctor finished."
