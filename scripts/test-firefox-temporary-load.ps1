param(
  [string]$Firefox = "C:\Program Files\Mozilla Firefox\firefox.exe",
  [int]$TimeoutSeconds = 120,
  [switch]$SkipLint
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $root "dist"
$webExtPackage = "web-ext@10.4.0"

function Assert-True($condition, $message) {
  if (-not $condition) {
    throw $message
  }
}

function Get-JobText($job) {
  $lines = Receive-Job -Job $job -Keep
  if (-not $lines) {
    return ""
  }

  return ($lines | ForEach-Object { $_.ToString() }) -join "`n"
}

function Stop-FirefoxProfileProcesses($profilePath) {
  Get-CimInstance Win32_Process |
    Where-Object { $_.Name -like "firefox*" -and $_.CommandLine -and $_.CommandLine.Contains($profilePath) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Remove-TemporaryProfile($profilePath) {
  $resolvedProfile = [System.IO.Path]::GetFullPath($profilePath)
  $resolvedTemp = [System.IO.Path]::GetFullPath($env:TEMP)
  $profileName = [System.IO.Path]::GetFileName($resolvedProfile)

  Assert-True ($resolvedProfile.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase)) "Refusing to remove profile outside TEMP: $resolvedProfile"
  Assert-True ($profileName.StartsWith("storepilot-webext-profile-", [System.StringComparison]::OrdinalIgnoreCase)) "Refusing to remove unexpected profile path: $resolvedProfile"

  if (Test-Path -LiteralPath $resolvedProfile) {
    Remove-Item -LiteralPath $resolvedProfile -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Assert-True (Test-Path -LiteralPath $sourceDir -PathType Container) "dist/ is missing. Run scripts\build.ps1 first."
Assert-True (Test-Path -LiteralPath (Join-Path $sourceDir "manifest.json") -PathType Leaf) "dist/manifest.json is missing. Run scripts\build.ps1 first."
Assert-True (Test-Path -LiteralPath $Firefox -PathType Leaf) "Firefox executable not found: $Firefox"

if (-not $SkipLint) {
  & npx --yes $webExtPackage lint --no-config-discovery --source-dir $sourceDir --self-hosted
  Assert-True ($LASTEXITCODE -eq 0) "web-ext lint failed."
}

$profile = Join-Path $env:TEMP ("storepilot-webext-profile-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $profile | Out-Null

$job = Start-Job -ScriptBlock {
  param($root, $sourceDir, $profile, $firefox, $webExtPackage)

  Set-Location -LiteralPath $root
  & npx --yes $webExtPackage run `
    --no-config-discovery `
    --source-dir $sourceDir `
    --firefox $firefox `
    --firefox-profile $profile `
    --keep-profile-changes `
    --profile-create-if-missing `
    --no-reload `
    --start-url "about:debugging#/runtime/this-firefox" `
    --verbose 2>&1 | ForEach-Object { $_.ToString() }
} -ArgumentList $root, $sourceDir, $profile, $Firefox, $webExtPackage

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$loaded = $false
$output = ""

try {
  while ((Get-Date) -lt $deadline -and $job.State -eq "Running") {
    Start-Sleep -Milliseconds 750
    $output = Get-JobText $job

    if ($output -match "installTemporaryAddon" -or $output -match "Installed .+ as a temporary add-on") {
      $loaded = $true
      break
    }

    if ($output -match "WebExtError" -or $output -match "not compatible" -or $output -match "This command does not take any arguments") {
      break
    }
  }

  $output = Get-JobText $job

  if (-not $loaded) {
    $tail = (($output -split "`r?`n") | Select-Object -Last 80) -join "`n"
    throw "Firefox temporary add-on load did not complete within $TimeoutSeconds seconds.`n$tail"
  }

  Write-Host "web-ext lint passed for dist/."
  Write-Host "Firefox temporary add-on load passed for dist/ using $Firefox."
} finally {
  Stop-Job -Job $job -ErrorAction SilentlyContinue | Out-Null
  Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
  Stop-FirefoxProfileProcesses $profile
  Remove-TemporaryProfile $profile
}
