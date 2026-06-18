$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$artifacts = Join-Path $root "artifacts\source"
$manifest = Get-Content -LiteralPath (Join-Path $root "manifest.json") -Raw | ConvertFrom-Json
$version = [string]$manifest.version
$zip = Join-Path $artifacts "storepilot-source-$version.zip"

if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}

New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
Get-ChildItem -LiteralPath $artifacts -File -Filter "storepilot-source-*.zip" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -ne $zip } |
  Remove-Item -Force

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipArchive = [System.IO.Compression.ZipFile]::Open($zip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $files = & git -C $root ls-files --cached
  if ($LASTEXITCODE -ne 0) {
    throw "git ls-files failed."
  }

  foreach ($file in $files) {
    $sourcePath = Join-Path $root $file
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
      continue
    }

    $entryPath = $file.Replace("\", "/")
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zipArchive, $sourcePath, $entryPath) | Out-Null
  }
} finally {
  $zipArchive.Dispose()
}

Write-Host "Packaged AMO source zip: $zip"
