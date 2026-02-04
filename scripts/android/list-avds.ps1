param()

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

Write-Host "Android SDK: $sdkRoot"
Write-Host "Emulator: $emulatorExe"
Write-Host ""
Write-Host "Available AVDs:"
& $emulatorExe -list-avds

