$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$submissionFile = Join-Path $root "docs\amo-submission.md"
$maxReviewerNotesCharacters = 3000

if (-not (Test-Path -LiteralPath $submissionFile -PathType Leaf)) {
  throw "AMO submission file not found: $submissionFile"
}

$content = Get-Content -LiteralPath $submissionFile -Raw
$pattern = '(?ms)^Notes to Reviewer:\s*\r?\n\s*```text\r?\n(?<notes>.*?)\r?\n```'
$match = [regex]::Match($content, $pattern)

if (-not $match.Success) {
  throw "Could not find the Notes to Reviewer text block in docs/amo-submission.md."
}

# AMO's textarea counter treats pasted line endings as LF. Normalize before counting
# so Windows checkout line endings do not create false failures.
$notes = $match.Groups["notes"].Value -replace "`r`n", "`n" -replace "`r", "`n"
$length = $notes.Length
Write-Host "AMO Notes to Reviewer length: $length / $maxReviewerNotesCharacters characters"

if ($length -gt $maxReviewerNotesCharacters) {
  throw "AMO Notes to Reviewer exceeds $maxReviewerNotesCharacters characters by $($length - $maxReviewerNotesCharacters)."
}

Write-Host "AMO submission checks passed."
