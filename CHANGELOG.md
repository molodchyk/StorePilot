# Changelog

## Unreleased

- Moved release and project maintenance documents under `docs/` to keep the repository root focused on package identity and primary policy files.
- Added release checks that reject old root documentation stubs and verify the moved docs are included in AMO source packages.
- Moved the README Support block after privacy, license, and source information, then added a release check for that section order.
- Documented manifest-derived package artifact names in README and added release-check coverage for that convention.
- Added source-package freshness validation so AMO source zips must match the current tracked file set and file contents.
- Documented that published GitHub releases are immutable snapshots for their exact version; replacement uploads after a version bump should use a new release.
- Added explicit English fallback strings for newly added runtime locale keys and tightened release checks so locale files must match the default key set and placeholder names.
- Split popup settings and theme handling into a focused popup helper, with runtime-load checks covering the new script order.
- Split background media upload orchestration into a focused helper, leaving the background entry as thin message/action wiring.
- Split dashboard project-context detection and binding resolution into a focused content helper loaded before the dashboard entry.

## 1.3.1 - 2026-06-18

- Fixed dashboard content-script load order after the modularization split so the popup and dashboard panel can resolve active projects again.
- Made popup fallback injection match the manifest content-script list, including shared project-resolution dependencies.
- Added popup startup diagnostics instead of leaving the popup stuck on "Loading listings..." when initialization fails.
- Added a runtime load-surface unit test to catch missing manifest or popup injection dependencies.
- Made release package scripts read the version from `manifest.json` instead of hardcoding artifact names.

## 1.3.0.1 - 2026-06-17

- Rebuilt AMO upload after a submission-side glitch. No extension behavior changes from 1.3.0.
- Added `docs/reference.md` as a pasteable project-reference document synced with the options Reference tab.

## 1.3.0 - 2026-06-17

- Added Chrome Web Store category document detection and a Select category action for the listing page.
- Added Additional fields document detection and fill support for Official URL, Homepage URL, Support URL, and Mature content.
- Added Data Usage detection, an options-page Data Usage view, and a dedicated Fill data usage action for the Chrome Web Store Privacy page.
- Made Fill data usage apply explicit no values by unchecking stale Chrome Web Store disclosure boxes.
- Added remote-code Yes/No radio handling and `remote_code_justification` support for the Chrome Web Store Privacy page.
- Added Chrome Web Store item-id to StorePilot project bindings so multiple open dashboard tabs keep their own project context.
- Renamed Store Media Assets UI wording to Graphic Assets to match Chrome Web Store terminology.
- Renamed the main listing action to Fill descriptions and moved the old current-language filler behind an advanced preference.
- Added reference documentation for one-language project structure, detailed description files, category files, Additional fields, Graphic Assets, Privacy documents, and Data Usage disclosure keys.
- Clarified that Data Usage yes/no values describe developer or third-party collection, not local-only permission access or storage.
- Improved options-page layout for the expanded status cards, tabs, and long reference keys.
- Added release-prep documentation, a roadmap, line-ending normalization, and refreshed AMO submission notes.
