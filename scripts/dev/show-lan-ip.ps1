param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "LAN IP helper (for iOS device / physical phone)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Goal: set EXPO_PUBLIC_API_BASE_URL to your PC LAN IP (not localhost) so the phone can reach the backend."
Write-Host "Example: EXPO_PUBLIC_API_BASE_URL=http://192.168.0.123:3000"
Write-Host ""

$addrs = @()
try {
  $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object {
      $_.IPAddress -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.IPAddress -notlike "127.*"
    } |
    Select-Object IPAddress, InterfaceAlias, PrefixOrigin |
    Sort-Object InterfaceAlias, IPAddress
} catch {
  Write-Host "Get-NetIPAddress not available. Falling back to ipconfig parsing." -ForegroundColor Yellow
  $raw = ipconfig
  $matches = ($raw | Select-String -Pattern "IPv4 Address" -SimpleMatch)
  foreach ($m in $matches) {
    $ip = ($m.Line -split ":\s*")[-1].Trim()
    if ($ip -and $ip -notlike "169.254.*" -and $ip -notlike "127.*") {
      $addrs += [pscustomobject]@{ IPAddress = $ip; InterfaceAlias = "unknown"; PrefixOrigin = "unknown" }
    }
  }
}

if (-not $addrs -or $addrs.Count -eq 0) {
  Write-Host "No IPv4 LAN addresses found." -ForegroundColor Red
  Write-Host "Make sure you're connected to Wi-Fi/Ethernet."
  exit 1
}

Write-Host "Detected IPv4 addresses:"
$addrs | ForEach-Object {
  Write-Host ("- {0} ({1})" -f $_.IPAddress, $_.InterfaceAlias)
}

Write-Host ""
Write-Host "Suggested base URLs (try one):" -ForegroundColor Green
$addrs | ForEach-Object {
  Write-Host ("- http://{0}:3000" -f $_.IPAddress)
}

Write-Host ""
Write-Host "Notes:" -ForegroundColor DarkGray
Write-Host "- Ensure your phone is on the same network."
Write-Host "- Windows Firewall may block inbound port 3000; allow Node/port 3000 if needed."

