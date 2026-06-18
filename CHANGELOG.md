# Changelog

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
