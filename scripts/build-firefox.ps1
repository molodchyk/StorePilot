$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist-firefox"
$zip = Join-Path $root "storepilot-firefox-0.1.0.zip"

if (Test-Path -LiteralPath $dist) {
  Remove-Item -LiteralPath $dist -Recurse -Force
}

if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}

New-Item -ItemType Directory -Path $dist | Out-Null
Copy-Item -Path (Join-Path $root "src") -Destination (Join-Path $dist "src") -Recurse
Copy-Item -Path (Join-Path $root "manifest.firefox.json") -Destination (Join-Path $dist "manifest.json")

Compress-Archive -Path (Join-Path $dist "*") -DestinationPath $zip

Write-Host "Built Firefox distribution: $dist"
Write-Host "Packaged Firefox zip: $zip"
