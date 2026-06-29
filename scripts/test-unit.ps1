$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {
  throw "Node.js is required to run unit tests. The extension package build does not require Node.js."
}

& $node.Source (Join-Path $root "test\project-resolution.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}

& $node.Source (Join-Path $root "test\project-localization.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}

& $node.Source (Join-Path $root "test\media-assets.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}

& $node.Source (Join-Path $root "test\dashboard-media-targets.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}

& $node.Source (Join-Path $root "test\media-review-order.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}

& $node.Source (Join-Path $root "test\parallel-localized-screenshots.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}

& $node.Source (Join-Path $root "test\parallel-timeline-chart.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}

& $node.Source (Join-Path $root "test\localized-screenshot-log-analysis.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}

& $node.Source (Join-Path $root "test\runtime-load-surfaces.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}

& $node.Source (Join-Path $root "test\privacy-doc.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}

& $node.Source (Join-Path $root "test\privacy-field-matching.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}

& $node.Source (Join-Path $root "test\theme-settings.test.js")
if ($LASTEXITCODE -ne 0) {
  throw "Unit tests failed."
}
