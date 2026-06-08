$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$artifacts = Join-Path $root "artifacts\source"
$zip = Join-Path $artifacts "storepilot-source-1.1.2.zip"

if (Test-Path -LiteralPath $zip) {
  Remove-Item -LiteralPath $zip -Force
}

New-Item -ItemType Directory -Path $artifacts -Force | Out-Null

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$zipArchive = [System.IO.Compression.ZipFile]::Open($zip, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  $files = & git -C $root ls-files --cached --others --exclude-standard
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
