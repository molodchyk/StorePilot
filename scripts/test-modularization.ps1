$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Assert-True($condition, $message) {
  if (-not $condition) {
    throw $message
  }
}

function Read-Text($relativePath) {
  return Get-Content -LiteralPath (Join-Path $root $relativePath) -Raw
}

function Assert-TextContains($name, $text, $needle) {
  Assert-True ($text.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) "$name is missing required text: $needle"
}

function Get-RelativePath($path) {
  $rootPath = (Resolve-Path -LiteralPath $root).Path.TrimEnd("\") + "\"
  return $path.FullName.Substring($rootPath.Length).Replace("\", "/")
}

$audit = Read-Text "docs\firefox-modularization-audit.md"
$storage = Read-Text "docs\storage-ownership.md"

Assert-TextContains "docs/firefox-modularization-audit.md" $audit "Result: deferred with reason."
Assert-TextContains "docs/firefox-modularization-audit.md" $audit "src/content/dashboard-helper.js"
Assert-TextContains "docs/firefox-modularization-audit.md" $audit "src/options/options.js"
Assert-TextContains "docs/firefox-modularization-audit.md" $audit "src/options/options.css"
Assert-TextContains "docs/firefox-modularization-audit.md" $audit "src/popup/popup.js"
Assert-TextContains "docs/firefox-modularization-audit.md" $audit "Introduce WebExtension platform wrappers"

foreach ($needle in @(
  "storePilotProjects",
  "storePilotActiveProjectId",
  "storePilotDashboardProjectBindings",
  "storePilotSettings",
  "storePilotFillAllStatus",
  "storePilotListings",
  "storePilotHandles",
  "handles",
  "mediaFiles",
  "storePilotPanelPosition",
  "storePilotPanelMode"
)) {
  Assert-TextContains "docs/storage-ownership.md" $storage $needle
}

$sourceFiles = Get-ChildItem -LiteralPath (Join-Path $root "src") -Recurse -File |
  Where-Object { $_.Extension -in @(".js", ".css") }

$overBudget = @()
foreach ($file in $sourceFiles) {
  $relativePath = Get-RelativePath $file
  $lines = (Get-Content -LiteralPath $file.FullName | Measure-Object -Line).Lines

  if ($lines -gt 600) {
    $overBudget += [pscustomobject]@{
      Path = $relativePath
      Lines = $lines
    }
    Assert-TextContains "docs/firefox-modularization-audit.md" $audit $relativePath
  }
}

$rawApiPattern = '\b(?:STOREPILOT_API|browser|chrome)\.(?:storage|runtime|tabs|scripting|i18n|action)\b'
$allowedRawApiFiles = @(
  "src/background.js",
  "src/content/dashboard-helper.js",
  "src/options/options.js",
  "src/popup/popup.js",
  "src/shared/constants.js",
  "src/shared/i18n.js",
  "src/shared/storage.js"
)

$rawApiFiles = $sourceFiles |
  Where-Object { (Get-Content -LiteralPath $_.FullName -Raw) -match $rawApiPattern } |
  ForEach-Object { Get-RelativePath $_ }

foreach ($rawApiFile in $rawApiFiles) {
  Assert-True ($allowedRawApiFiles -contains $rawApiFile) "Raw WebExtension API usage appears outside known boundary files: $rawApiFile"
}

$trackedFiles = & git -C $root ls-files
Assert-True ($LASTEXITCODE -eq 0) "git ls-files failed while checking folder density."

$folderFileCounts = $trackedFiles |
  Where-Object { $_ -and -not ($_ -match '^_locales/[^/]+/messages\.json$') } |
  ForEach-Object {
    $directory = Split-Path -Parent ($_ -replace '/', [System.IO.Path]::DirectorySeparatorChar)
    if ($directory) {
      $directory.Replace("\", "/")
    } else {
      "."
    }
  } |
  Group-Object |
  ForEach-Object {
    $relativePath = $_.Name
    $limit = if ($relativePath -like "src/features/*") { 15 } else { 12 }
    [pscustomobject]@{
      Path = $relativePath
      Count = $_.Count
      Limit = $limit
    }
  }

foreach ($folder in $folderFileCounts) {
  if ($folder.Count -gt $folder.Limit) {
    Assert-TextContains "docs/firefox-modularization-audit.md" $audit $folder.Path
  }
}

Write-Host "Modularization audit checks passed."
if ($overBudget.Count) {
  Write-Host "Tracked over-budget source files:"
  $overBudget | Sort-Object Lines -Descending | ForEach-Object {
    Write-Host ("- {0}: {1} lines" -f $_.Path, $_.Lines)
  }
}
