param(
  [Parameter(Mandatory = $true)]
  [string]$AvdName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-AndroidSdkRoot {
  if ($env:ANDROID_SDK_ROOT -and (Test-Path $env:ANDROID_SDK_ROOT)) { return $env:ANDROID_SDK_ROOT }
  if ($env:ANDROID_HOME -and (Test-Path $env:ANDROID_HOME)) { return $env:ANDROID_HOME }

  $default = Join-Path $env:LOCALAPPDATA "Android\\Sdk"
  if (Test-Path $default) { return $default }

  throw "Android SDK not found. Set ANDROID_SDK_ROOT (or ANDROID_HOME)."
}

$sdkRoot = Get-AndroidSdkRoot
$emulatorExe = Join-Path $sdkRoot "emulator\\emulator.exe"

if (-not (Test-Path $emulatorExe)) {
  throw "Android emulator binary not found at: $emulatorExe. Ensure Android SDK 'emulator' package is installed."
}

$avds = @(& $emulatorExe -list-avds) | ForEach-Object { $_.Trim() } | Where-Object { $_ }
if (-not $avds -or $avds.Count -eq 0) {
  throw "No AVDs found. Create one in Android Studio (Device Manager) first."
}

if ($avds -notcontains $AvdName) {
  Write-Host "AVD '$AvdName' not found. Available AVDs:" -ForegroundColor Yellow
  $avds | ForEach-Object { Write-Host "  - $_" }
  exit 1
}

Write-Host "Starting emulator: $AvdName"
Write-Host "Android SDK: $sdkRoot"

# Detach so VS Code task returns immediately.
$proc = Start-Process -FilePath $emulatorExe -ArgumentList @(
  "-avd", $AvdName,
  "-netdelay", "none",
  "-netspeed", "full"
) -PassThru

Write-Host "Emulator process started (PID $($proc.Id))."

