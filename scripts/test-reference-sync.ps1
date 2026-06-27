$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$referenceDoc = Join-Path $root "docs\reference.md"
$optionsHtml = Join-Path $root "src\options\options.html"

if (-not (Test-Path -LiteralPath $referenceDoc -PathType Leaf)) {
  throw "Reference doc not found: $referenceDoc"
}

if (-not (Test-Path -LiteralPath $optionsHtml -PathType Leaf)) {
  throw "Options page not found: $optionsHtml"
}

function Normalize-ReferenceText($value) {
  $text = [System.Net.WebUtility]::HtmlDecode([string]$value)
  $text = $text.Replace("`r`n", "`n").Replace("`r", "`n")
  $text = $text.Replace([string][char]0x2013, "-").Replace([string][char]0x2014, "-")
  return $text
}

function Assert-Contains($name, $text, $needle) {
  if ($text.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
    throw "$name is missing reference content: $needle"
  }
}

$docText = Normalize-ReferenceText (Get-Content -LiteralPath $referenceDoc -Raw)
$optionsText = Normalize-ReferenceText (Get-Content -LiteralPath $optionsHtml -Raw)

$sharedNeedles = @(
  "my-extension/",
  "store-listing/",
  "chrome-web-store/",
  "listing/",
  "en.txt",
  "Do not include the extension name",
  "not recommended for new direct listing files",
  "chrome-web-store-additional-fields.md",
  "chrome-web-store-category.md",
  "chrome-web-store-privacy-form.md",
  "Detailed description text",
  "docs/chrome-web-store.md",
  "Fields not imported",
  "Graphic assets",
  "screenshots/<locale>/01-name.png",
  "media/screenshots/",
  "media/screenshots/en/",
  "official_url:",
  "homepage_url:",
  "support_url:",
  "mature_content:",
  "Selected category: Functionality and UI",
  "Productivity",
  "Lifestyle",
  "Make Chrome Yours",
  "Functionality and UI",
  "Privacy automation document reference",
  "remote_code:",
  "remote_code_justification",
  "privacy_policy_url",
  "data_usage.personally_identifiable_information",
  "data_usage.health_information",
  "data_usage.financial_payment_information",
  "data_usage.authentication_information",
  "data_usage.personal_communications",
  "data_usage.location",
  "data_usage.web_history",
  "data_usage.user_activity",
  "data_usage.website_content",
  "certification.no_sell_or_transfer",
  "certification.no_unrelated_use",
  "certification.no_creditworthiness",
  "permission.storage",
  "permission.declarativeNetRequestWithHostAccess",
  "permission.nativeMessaging",
  "permission.debugger"
)

foreach ($needle in $sharedNeedles) {
  Assert-Contains "docs/reference.md" $docText $needle
  Assert-Contains "src/options/options.html Reference tab" $optionsText $needle
}

$docOnlyNeedles = @(
  "scripts\test-reference-sync.ps1",
  "Use it as the pasteable project-structure contract"
)

foreach ($needle in $docOnlyNeedles) {
  Assert-Contains "docs/reference.md" $docText $needle
}

Write-Host "Reference sync checks passed."
