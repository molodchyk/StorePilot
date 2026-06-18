# StorePilot Roadmap Notes

This file tracks plausible next automation steps that are not implemented yet. These notes are intentionally separate from the current specification so future work does not read like supported behavior.

## Chrome Web Store Product And Privacy Helpers

Observed follow-up ideas:

- Remote code answer helper: detect a project privacy document value for `remote_code`, choose `No, I am not using remote code` when the value is negative, or choose `Yes, I am using remote code` and paste the justification when the value is positive. This should remain an explicit user-triggered action because the answer is policy-sensitive.
- Localised graphic assets helper: optionally scan and upload localised screenshots, and optionally paste localised promo video URLs when a project has language-specific asset folders or a structured asset document.
- Additional fields refinements: support localized additional-field values, stronger Official URL diagnostics, and better handling when the desired official site is not already present in the dashboard dropdown.

Likely next implementation:

1. Improve Additional fields and Data usage diagnostics after testing more real dashboard states.
2. Defer remote-code automation and localised asset upload until they are needed often enough to justify the added policy and UI handling.

Safety notes:

- Never click final submit, publish, or review actions.
- Keep all helpers explicit and reviewable from the popup or dashboard panel.
- Treat policy-sensitive answers, including remote code and data usage, as imported evidence plus user confirmation rather than hidden automatic decisions.

## Firefox Architecture Follow-Ups

The current modularization gate result is tracked in `docs/firefox-modularization-audit.md` as deferred with reason. Do these in small verified commits rather than during release-prep packaging:

1. Split dashboard fill feature modules.
2. Extract options project review modules.
3. Introduce WebExtension platform wrappers.
4. Continue tightening `scripts/test-modularization.ps1` until it can enforce file-size, folder-density, and API-boundary budgets without release deferrals.

Completed slices:

- Documented storage key ownership in `docs/storage-ownership.md`.
- Added `scripts/test-modularization.ps1` so file-size and tracked folder-density pressure stays visible in release checks.
