# StorePilot Specification

## Product Goal

StorePilot should reduce manual browser extension publishing work, especially localized store listing copy/paste.

## MVP Scope

- Chrome extension, Manifest V3.
- No build step.
- Import flat listing files from a selected folder.
- File naming convention: `<locale>.txt`.
- Store imported listings in `chrome.storage.local`.
- Inject a helper panel into Chrome Web Store Developer Dashboard pages.
- Let the user copy or fill listing text for the selected locale.

## Non-Goals for MVP

- No automatic submission click.
- No credential handling.
- No unrestricted local filesystem access.
- No remote sync.
- No automatic publishing API integration yet.

## Future Capabilities

- Upload extension zip.
- Upload screenshots and promo images.
- Fill permission justifications and review notes.
- Validate missing listing/media assets.
- Generate or update release checklist files.
- Chrome Web Store API integration for package upload/publish where the API is safer than UI automation.
- Firefox AMO and Edge Add-ons support.

## Safety Rules

- Never click final submit/publish automatically without explicit user action.
- Prefer filling fields and showing review state over irreversible actions.
- Keep imported project text local unless the user explicitly exports or submits it.
