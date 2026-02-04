param(
  [string]$Url,
  [ValidateSet("localhost", "android", "lan-first")]
  [string]$Preset,
  [int]$Port = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-LanIpv4Addresses {
  $addrs = @()
  try {
    $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object {
        $_.IPAddress -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.IPAddress -notlike "127.*"
      } |
      Select-Object IPAddress, InterfaceAlias |
      Sort-Object InterfaceAlias, IPAddress
  } catch {
    $addrs = @()
  }
  return $addrs
}

function ResolveUrl([string]$url, [string]$preset, [int]$port) {
  if ($url -and $url.Trim()) { return $url.Trim() }

  if (-not $preset) {
    throw "Provide -Url or -Preset (localhost|android|lan-first)."
  }

  if ($preset -eq "localhost") {
    return "http://localhost:$port"
  }
  if ($preset -eq "android") {
    return "http://10.0.2.2:$port"
  }
  if ($preset -eq "lan-first") {
    $addrs = Get-LanIpv4Addresses
    if (-not $addrs -or $addrs.Count -eq 0) {
      throw "No LAN IPv4 address found. Connect to Wi-Fi/Ethernet and retry (or pass -Url)."
    }
    return ("http://{0}:{1}" -f $addrs[0].IPAddress, $port)
  }

  throw "Unknown preset: $preset"
}

$targetUrl = ResolveUrl -url $Url -preset $Preset -port $Port

$envPath = "apps/mobile/.env"
if (-not (Test-Path $envPath)) {
  throw "Missing $envPath. Run VS Code task 'Dev: Bootstrap env (.env from .env.example)' first."
}

$raw = Get-Content -Raw -Path $envPath
$lines = $raw -split "`r?`n"

$key = "EXPO_PUBLIC_API_BASE_URL"
$newLine = "$key=$targetUrl"

$found = $false
$outLines = @()
foreach ($line in $lines) {
  if ($line -match "^\s*$key\s*=") {
    $outLines += $newLine
    $found = $true
  } else {
    $outLines += $line
  }
}

if (-not $found) {
  $outLines += $newLine
}

$out = ($outLines -join "`r`n").TrimEnd() + "`r`n"
Set-Content -Path $envPath -Value $out -NoNewline

Write-Host "Updated apps/mobile/.env" -ForegroundColor Green
Write-Host $newLine -ForegroundColor Cyan
Write-Host ""
Write-Host "Tip: restart Metro after changing .env (stop/start 'Mobile: Metro (Expo)')." -ForegroundColor DarkGray

