$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

function Assert-True($condition, $message) {
  if (-not $condition) {
    throw $message
  }
}

function Assert-File($path, $message) {
  Assert-True (Test-Path -LiteralPath $path -PathType Leaf) $message
}

function Assert-TrackedFile($relativePath) {
  & git -C $root ls-files --error-unmatch -- $relativePath *> $null
  Assert-True ($LASTEXITCODE -eq 0) "Required source file is not tracked and will be omitted from the AMO source package: $relativePath"
}

function Assert-Directory($path, $message) {
  Assert-True (Test-Path -LiteralPath $path -PathType Container) $message
}

function Read-Text($relativePath) {
  return Get-Content -LiteralPath (Join-Path $root $relativePath) -Raw
}

function Assert-TextContains($name, $text, $needle) {
  Assert-True ($text.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) "$name is missing required text: $needle"
}

function Assert-ManifestFile($relativePath) {
  $normalized = [string]$relativePath
  Assert-True ($normalized -and -not [System.IO.Path]::IsPathRooted($normalized)) "Manifest path must be relative: $normalized"
  $file = Join-Path $root ($normalized -replace "/", [System.IO.Path]::DirectorySeparatorChar)
  Assert-File $file "Manifest references missing file: $normalized"
}

function Assert-ZipEntries($zipPath, $requiredEntries) {
  Assert-File $zipPath "Expected package not found: $zipPath"

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $zipPath))
  try {
    $entries = @($zip.Entries | Select-Object -ExpandProperty FullName)
    Assert-True (-not ($entries | Where-Object { $_ -match "\\" })) "$zipPath contains Windows backslash paths."
    foreach ($entry in $requiredEntries) {
      Assert-True ($entries -contains $entry) "$zipPath is missing required entry: $entry"
    }
  } finally {
    $zip.Dispose()
  }
}

$requiredFiles = @(
  "README.md",
  "LICENSE",
  "PRIVACY.md",
  "manifest.json",
  "docs\amo-submission.md",
  "docs\project-scope-and-philosophy.md",
  "docs\specifications.md",
  "docs\roadmap.md",
  "assets\icons\icon16.png",
  "assets\icons\icon32.png",
  "assets\icons\icon48.png",
  "assets\icons\icon96.png",
  "assets\icons\icon128.png",
  "src\platform\webextension.js",
  "src\options\options-reference.css",
  "src\options\options-responsive.css",
  "src\options\options-theme.css",
  "src\options\options-media.js",
  "src\options\options-review-tables.js",
  "src\shared\dashboard-url.js",
  "src\shared\store-docs\privacy-doc.js",
  "src\shared\store-docs\category-doc.js",
  "src\shared\store-docs\additional-fields-doc.js",
  "src\content\dashboard-dom.js",
  "src\content\language\locale.js",
  "src\content\dashboard-category.js",
  "src\content\language\picker.js",
  "src\content\language\description-fill.js",
  "src\content\dashboard-additional-fields.js",
  "src\content\dashboard-privacy-core.js",
  "src\content\dashboard-privacy-data-usage.js",
  "src\content\dashboard-privacy-fields.js",
  "src\content\dashboard-media.js",
  "src\content\panel\state.js",
  "src\content\panel\render.js",
  "src\content\dashboard-panel-styles.js",
  "src\popup\dashboard-page.js",
  "docs\firefox-extension-modularization-playbook.md",
  "docs\firefox-modularization-audit.md",
  "docs\firefox-localization.md",
  "docs\release-hygiene.md",
  "docs\reference.md",
  "docs\storage-ownership.md",
  "store-listing\amo\README.md",
  "store-listing\amo\listing\en-US.md",
  "store-listing\amo\media\screenshots.md",
  "scripts\build.ps1",
  "scripts\build-amo-source.ps1",
  "scripts\test-modularization.ps1",
  "scripts\test-unit.ps1",
  "scripts\test-amo-submission.ps1",
  "scripts\test-reference-sync.ps1",
  "scripts\test-firefox-temporary-load.ps1",
  "test\project-resolution.test.js",
  "test\runtime-load-surfaces.test.js"
)

foreach ($file in $requiredFiles) {
  Assert-File (Join-Path $root $file) "Required repository file is missing: $file"
  Assert-TrackedFile $file
}

Assert-Directory (Join-Path $root "src") "src/ is missing."
Assert-Directory (Join-Path $root "assets") "assets/ is missing."
Assert-Directory (Join-Path $root "_locales") "_locales/ is missing."
Assert-Directory (Join-Path $root "store-listing") "store-listing/ is missing."
Assert-True (-not (Test-Path -LiteralPath (Join-Path $root "LICENSE.txt"))) "Duplicate LICENSE.txt should not exist; keep one canonical LICENSE file."
foreach ($oldRootDoc in @(
  "AMO_SUBMISSION.md",
  "PROJECT_SCOPE_AND_PHILOSOPHY.md",
  "ROADMAP.md",
  "SPEC.md",
  "SPECIFICATIONS.md"
)) {
  Assert-True (-not (Test-Path -LiteralPath (Join-Path $root $oldRootDoc))) "Root documentation clutter should stay in docs/: $oldRootDoc"
}

$manifest = Read-Text "manifest.json" | ConvertFrom-Json
$version = [string]$manifest.version
Assert-True ($version -match "^\d+\.\d+\.\d+(?:\.\d+)?$") "Manifest version is not release-like: $version"
Assert-True ($manifest.default_locale -eq "en") "manifest.default_locale should be en."
Assert-File (Join-Path $root "_locales\en\messages.json") "Default locale messages file is missing."

foreach ($permission in @("storage", "unlimitedStorage", "activeTab", "scripting")) {
  Assert-True ($manifest.permissions -contains $permission) "Manifest missing expected permission: $permission"
}

foreach ($hostPermission in @("https://chrome.google.com/webstore/devconsole/*", "https://chromewebstore.google.com/devconsole/*")) {
  Assert-True ($manifest.host_permissions -contains $hostPermission) "Manifest missing expected host permission: $hostPermission"
}

Assert-True ($manifest.browser_specific_settings.gecko.id -eq "storepilot@molodchyk.dev") "Gecko id is not the expected StorePilot id."
Assert-True ($manifest.browser_specific_settings.gecko.strict_min_version -eq "140.0") "Firefox strict_min_version should be 140.0."
Assert-True ($manifest.browser_specific_settings.gecko_android.strict_min_version -eq "142.0") "Firefox Android strict_min_version should be 142.0."
Assert-True ($manifest.browser_specific_settings.gecko.data_collection_permissions.required -contains "none") "Gecko data_collection_permissions.required must include none."

foreach ($iconPath in $manifest.icons.PSObject.Properties.Value) {
  Assert-ManifestFile $iconPath
}

foreach ($iconPath in $manifest.action.default_icon.PSObject.Properties.Value) {
  Assert-ManifestFile $iconPath
}

Assert-ManifestFile $manifest.options_ui.page

foreach ($script in $manifest.background.scripts) {
  Assert-ManifestFile $script
}

foreach ($contentScript in $manifest.content_scripts) {
  foreach ($script in $contentScript.js) {
    Assert-ManifestFile $script
  }
}

foreach ($resourceSet in $manifest.web_accessible_resources) {
  foreach ($resource in $resourceSet.resources) {
    Assert-ManifestFile $resource
  }
}

Get-ChildItem -LiteralPath (Join-Path $root "_locales") -Directory | ForEach-Object {
  Assert-True ($_.Name -notmatch "-") "Locale directory uses a hyphen; use underscores in _locales: $($_.Name)"
  $messagesFile = Join-Path $_.FullName "messages.json"
  Assert-File $messagesFile "Locale messages file is missing: $($_.Name)"
  $messages = Get-Content -LiteralPath $messagesFile -Raw | ConvertFrom-Json
  $messageKeys = @($messages.PSObject.Properties.Name)
  foreach ($key in @("extensionName", "extensionDescription", "reference", "resetLocalData", "resetLocalDataConfirm")) {
    Assert-True ($messageKeys -contains $key) "Locale $($_.Name) is missing required key: $key"
  }
}

$readme = Read-Text "README.md"
foreach ($needle in @(
  "about:debugging#/runtime/this-firefox",
  ".\scripts\test-unit.ps1",
  ".\scripts\test-firefox-release.ps1",
  ".\scripts\test-firefox-temporary-load.ps1",
  "store-listing/amo",
  "Reset local data",
  "https://github.com/molodchyk/StorePilot",
  "Buy Me a Coffee",
  "Patreon",
  "PRIVACY.md",
  "LICENSE"
)) {
  Assert-TextContains "README.md" $readme $needle
}

$privacyIndex = $readme.IndexOf("## Privacy", [System.StringComparison]::Ordinal)
$licenseIndex = $readme.IndexOf("## License", [System.StringComparison]::Ordinal)
$supportIndex = $readme.IndexOf("## Support", [System.StringComparison]::Ordinal)
Assert-True ($privacyIndex -ge 0 -and $licenseIndex -ge 0 -and $supportIndex -ge 0) "README.md must include Privacy, License, and Support sections."
Assert-True ($privacyIndex -lt $licenseIndex -and $licenseIndex -lt $supportIndex) "README.md Support block should appear after privacy and license/source information."

$releaseHygiene = Read-Text "docs\release-hygiene.md"
foreach ($needle in @(
  'v<manifest version>',
  'artifacts/storepilot-<version>.zip',
  'artifacts/source/storepilot-source-<version>.zip',
  'Keep one canonical license file: `LICENSE`',
  'Do not track generated zips'
)) {
  Assert-TextContains "docs/release-hygiene.md" $releaseHygiene $needle
}

$license = Read-Text "LICENSE"
Assert-TextContains "LICENSE" $license "GNU GENERAL PUBLIC LICENSE"
Assert-TextContains "LICENSE" $license "Version 3"

$trackedZipFiles = @(& git -C $root ls-files -- "*.zip")
Assert-True ($LASTEXITCODE -eq 0) "Could not inspect tracked zip files."
Assert-True ($trackedZipFiles.Count -eq 0) "Zip artifacts should not be tracked: $($trackedZipFiles -join ', ')"

$privacy = Read-Text "PRIVACY.md"
foreach ($needle in @(
  "StorePilot does not collect or transmit data",
  "storage",
  "unlimitedStorage",
  "activeTab",
  "scripting",
  "https://chrome.google.com/webstore/devconsole/*",
  "https://chromewebstore.google.com/devconsole/*",
  "data_collection_permissions",
  '"required": ["none"]',
  "does not sell, share, rent, or transfer user data",
  "does not load remote code",
  "no analytics, tracking, telemetry, ads",
  "Reset local data"
)) {
  Assert-TextContains "PRIVACY.md" $privacy $needle
}

$optionsHtml = Read-Text "src\options\options.html"
foreach ($needle in @(
  'id="resetLocalData"',
  'data-i18n="resetLocalData"',
  'data-i18n="resetLocalDataHint"'
)) {
  Assert-TextContains "src/options/options.html" $optionsHtml $needle
}

$optionsJs = Read-Text "src\options\options.js"
foreach ($needle in @(
  "storePilotResetLocalData",
  "resetLocalDataConfirm",
  "resetLocalDataDone",
  "resetLocalDataFailed"
)) {
  Assert-TextContains "src/options/options.js" $optionsJs $needle
}

$amo = Read-Text "docs\amo-submission.md"
foreach ($needle in @(
  "Open source under the [GPL-3.0-or-later license](https://github.com/molodchyk/StorePilot).",
  "https://github.com/molodchyk/StorePilot",
  "Reset local data",
  "browser_specific_settings.gecko.data_collection_permissions.required = [""none""]",
  ".\scripts\test-firefox-temporary-load.ps1",
  "artifacts/storepilot-$version.zip",
  "artifacts/source/storepilot-source-$version.zip"
)) {
  Assert-TextContains "docs/amo-submission.md" $amo $needle
}

$modularizationAudit = Read-Text "docs\firefox-modularization-audit.md"
foreach ($needle in @(
  "Result: deferred with reason.",
  "Split dashboard fill feature modules",
  "Extract options project review modules",
  "Introduce WebExtension platform wrappers",
  "docs/storage-ownership.md",
  "scripts/test-modularization.ps1"
)) {
  Assert-TextContains "docs/firefox-modularization-audit.md" $modularizationAudit $needle
}

$storageOwnership = Read-Text "docs\storage-ownership.md"
foreach ($needle in @(
  "storePilotProjects",
  "storePilotDashboardProjectBindings",
  "storePilotSettings",
  "storePilotFillAllStatus",
  "storePilotHandles",
  "storePilotPanelPosition",
  "storePilotPanelMode"
)) {
  Assert-TextContains "docs/storage-ownership.md" $storageOwnership $needle
}

$listing = Read-Text "store-listing\amo\listing\en-US.md"
foreach ($needle in @(
  "StorePilot: Chrome Web Store Automation",
  "Automate Chrome extension store listings",
  "StorePilot never clicks final submit, publish, or review actions automatically.",
  "Open source under the [GPL-3.0-or-later license](https://github.com/molodchyk/StorePilot).",
  "https://github.com/molodchyk/StorePilot",
  "Web Development",
  "Language Support",
  "privacy form"
)) {
  Assert-TextContains "store-listing/amo/listing/en-US.md" $listing $needle
}

$media = Read-Text "store-listing\amo\media\screenshots.md"
foreach ($needle in @(
  "artifacts/screenshots/01-storepilot-options-project-overview.png",
  "artifacts/screenshots/02-storepilot-listing-dashboard-panel.png",
  "artifacts/screenshots/03-storepilot-media-assets-preview.png",
  "artifacts/screenshots/04-storepilot-privacy-dashboard-panel.png",
  "artifacts/screenshots/05-storepilot-dashboard-popup.png"
)) {
  Assert-TextContains "store-listing/amo/media/screenshots.md" $media $needle
}

$mediaScreenshotPattern = '(?m)^File:\s+`(?<path>artifacts/screenshots/[^`]+)`'
$mediaScreenshotMatches = [regex]::Matches($media, $mediaScreenshotPattern)
Assert-True ($mediaScreenshotMatches.Count -ge 1) "store-listing/amo/media/screenshots.md does not list screenshot artifact paths."
foreach ($match in $mediaScreenshotMatches) {
  $relativePath = $match.Groups["path"].Value -replace "/", [System.IO.Path]::DirectorySeparatorChar
  Assert-File (Join-Path $root $relativePath) "AMO media screenshot artifact is missing: $($match.Groups["path"].Value)"
}

$screenshotPattern = '(?m)^\d+\.\s+`(?<path>artifacts/screenshots/[^`]+)`'
$screenshotMatches = [regex]::Matches($amo, $screenshotPattern)
Assert-True ($screenshotMatches.Count -ge 1) "docs/amo-submission.md does not list screenshot artifact paths."
foreach ($match in $screenshotMatches) {
  $relativePath = $match.Groups["path"].Value -replace "/", [System.IO.Path]::DirectorySeparatorChar
  Assert-File (Join-Path $root $relativePath) "AMO screenshot artifact is missing: $($match.Groups["path"].Value)"
}

$amoListingReadme = Read-Text "store-listing\amo\README.md"
foreach ($needle in @(
  "limited set of Markdown",
  "summary is limited to 250 characters",
  "one shared screenshot set",
  "description can use bullets, links, bold, italic, blockquotes, and fenced code"
)) {
  Assert-TextContains "store-listing/amo/README.md" $amoListingReadme $needle
}

$sourceText = Get-ChildItem -LiteralPath (Join-Path $root "src") -Recurse -File |
  Where-Object { $_.Extension -in @(".js", ".html") } |
  ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw }

$remoteCodePatterns = @(
  "eval\s*\(",
  "new\s+Function\s*\(",
  "importScripts\s*\(\s*['""]https?://",
  "<script[^>]+src=['""]https?://"
)

foreach ($pattern in $remoteCodePatterns) {
  Assert-True (-not ($sourceText | Where-Object { $_ -match $pattern })) "Source contains remote-code-like pattern: $pattern"
}

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\test-unit.ps1")
Assert-True ($LASTEXITCODE -eq 0) "Unit test script failed."

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\test-modularization.ps1")
Assert-True ($LASTEXITCODE -eq 0) "Modularization test script failed."

$extensionZip = Join-Path $root "artifacts\storepilot-$version.zip"
Assert-ZipEntries $extensionZip @(
  "manifest.json",
  "assets/icons/icon128.png",
  "src/options/options.html",
  "src/options/options-reference.css",
  "src/options/options-responsive.css",
  "src/options/options-theme.css",
  "src/options/options-media.js",
  "src/options/options-review-tables.js",
  "src/shared/dashboard-url.js",
  "src/shared/store-docs/privacy-doc.js",
  "src/shared/store-docs/category-doc.js",
  "src/shared/store-docs/additional-fields-doc.js",
  "src/content/dashboard-dom.js",
  "src/content/language/locale.js",
  "src/content/dashboard-category.js",
  "src/content/language/picker.js",
  "src/content/language/description-fill.js",
  "src/content/dashboard-additional-fields.js",
  "src/content/dashboard-privacy-core.js",
  "src/content/dashboard-privacy-data-usage.js",
  "src/content/dashboard-privacy-fields.js",
  "src/content/dashboard-media.js",
  "src/content/panel/state.js",
  "src/content/panel/render.js",
  "src/content/dashboard-panel-styles.js",
  "src/popup/dashboard-page.js",
  "src/popup/popup.html",
  "src/background.js",
  "_locales/en/messages.json"
)

$sourceZip = Join-Path $root "artifacts\source\storepilot-source-$version.zip"
Assert-ZipEntries $sourceZip @(
  "manifest.json",
  "README.md",
  "LICENSE",
  "PRIVACY.md",
  "docs/amo-submission.md",
  "docs/project-scope-and-philosophy.md",
  "docs/specifications.md",
  "docs/roadmap.md",
  "assets/icons/icon128.png",
  "src/platform/webextension.js",
  "src/options/options-reference.css",
  "src/options/options-responsive.css",
  "src/options/options-theme.css",
  "src/options/options-media.js",
  "src/options/options-review-tables.js",
  "src/shared/dashboard-url.js",
  "src/shared/store-docs/privacy-doc.js",
  "src/shared/store-docs/category-doc.js",
  "src/shared/store-docs/additional-fields-doc.js",
  "src/content/dashboard-dom.js",
  "src/content/language/locale.js",
  "src/content/dashboard-category.js",
  "src/content/language/picker.js",
  "src/content/language/description-fill.js",
  "src/content/dashboard-additional-fields.js",
  "src/content/dashboard-privacy-core.js",
  "src/content/dashboard-privacy-data-usage.js",
  "src/content/dashboard-privacy-fields.js",
  "src/content/dashboard-media.js",
  "src/content/panel/state.js",
  "src/content/panel/render.js",
  "src/content/dashboard-panel-styles.js",
  "src/popup/dashboard-page.js",
  "docs/firefox-extension-modularization-playbook.md",
  "docs/firefox-modularization-audit.md",
  "docs/firefox-localization.md",
  "docs/release-hygiene.md",
  "docs/reference.md",
  "docs/storage-ownership.md",
  "store-listing/amo/README.md",
  "store-listing/amo/listing/en-US.md",
  "store-listing/amo/media/screenshots.md",
  "scripts/build.ps1",
  "scripts/build-amo-source.ps1",
  "scripts/test-modularization.ps1",
  "scripts/test-unit.ps1",
  "scripts/test-amo-submission.ps1",
  "scripts/test-reference-sync.ps1",
  "scripts/test-firefox-release.ps1",
  "scripts/test-firefox-temporary-load.ps1",
  "test/project-resolution.test.js",
  "test/runtime-load-surfaces.test.js"
)

$allowedArtifactZips = @(
  (Resolve-Path -LiteralPath $extensionZip).Path,
  (Resolve-Path -LiteralPath $sourceZip).Path
)
$allowedArtifactFiles = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($zipPath in $allowedArtifactZips) {
  [void]$allowedArtifactFiles.Add($zipPath)
}
foreach ($match in @($mediaScreenshotMatches) + @($screenshotMatches)) {
  $relativePath = $match.Groups["path"].Value -replace "/", [System.IO.Path]::DirectorySeparatorChar
  $resolved = (Resolve-Path -LiteralPath (Join-Path $root $relativePath)).Path
  [void]$allowedArtifactFiles.Add($resolved)
}
$artifactRoot = Join-Path $root "artifacts"
Get-ChildItem -LiteralPath $artifactRoot -Recurse -File -Filter "*.zip" | ForEach-Object {
  $resolved = (Resolve-Path -LiteralPath $_.FullName).Path
  Assert-True ($allowedArtifactZips -contains $resolved) "Old zip artifact should be removed before release: $resolved"
}
Get-ChildItem -LiteralPath $artifactRoot -Recurse -File | ForEach-Object {
  $resolved = (Resolve-Path -LiteralPath $_.FullName).Path
  Assert-True ($allowedArtifactFiles.Contains($resolved)) "Unexpected artifact should be removed before release: $resolved"
}

Write-Host "Firefox release checks passed for StorePilot $version."
