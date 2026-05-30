$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist-firefox"
$stagedDist = Join-Path $root "dist-firefox-next"
$artifacts = Join-Path $root "artifacts\firefox"
$zip = Join-Path $artifacts "storepilot-firefox-1.0.0.zip"

if (Test-Path -LiteralPath $stagedDist) {
  Remove-Item -LiteralPath $stagedDist -Recurse -Force
}

if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}

New-Item -ItemType Directory -Path $stagedDist | Out-Null
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
Copy-Item -Path (Join-Path $root "src") -Destination (Join-Path $stagedDist "src") -Recurse
if (Test-Path -LiteralPath (Join-Path $root "_locales")) {
  Copy-Item -Path (Join-Path $root "_locales") -Destination (Join-Path $stagedDist "_locales") -Recurse
}
Copy-Item -Path (Join-Path $root "manifest.firefox.json") -Destination (Join-Path $stagedDist "manifest.json")
& (Join-Path $root "src-firefox\apply-firefox-overrides.ps1") -Dist $stagedDist

Compress-Archive -Path (Join-Path $stagedDist "*") -DestinationPath $zip

try {
  if (Test-Path -LiteralPath $dist) {
    Remove-Item -LiteralPath $dist -Recurse -Force
  }
  Move-Item -LiteralPath $stagedDist -Destination $dist
} catch {
  Write-Warning "Could not replace dist-firefox, probably because Firefox is using it. Built staged copy at: $stagedDist"
  Write-Warning $_.Exception.Message
}

Write-Host "Built Firefox distribution: $dist"
Write-Host "Packaged Firefox zip: $zip"
