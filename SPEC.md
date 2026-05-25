# StorePilot Specification

## Product Goal

StorePilot should reduce manual browser extension publishing work, especially localized store listing copy/paste.

## MVP Scope

- Chrome extension, Manifest V3.
- No build step.
- Import flat listing files from a selected folder or detected project root.
- File naming convention: `<locale>.<text-like-extension>`, including `.txt`, `.md`, and `.markdown`.
- Store multiple extension projects separately.
- Store imported listings in `chrome.storage.local` per project.
- Request `unlimitedStorage` because localized listings can become large across multiple projects.
- Store project folder handles in IndexedDB so sync can re-read granted folders.
- Let the user sync the active project or all saved projects.
- Silently sync the active project when the popup opens if Chrome already grants folder permission.
- Inject a helper panel into Chrome Web Store Developer Dashboard pages.
- Let the user copy or fill listing text for the selected locale.
- Detect the Chrome Web Store current editing language dropdown.
- Fill the Chrome Web Store description field for the current dashboard language.
- Iterate the Chrome Web Store language menu and fill all matching imported locale listings.

## Non-Goals for MVP

- No automatic submission click.
- No credential handling.
- No unrestricted local filesystem access.
- No remote sync.
- No automatic publishing API integration yet.

## Project Model

- A project represents one browser extension being published.
- Each project has its own listing map, source path, sync metadata, confidence score, and optional saved folder handle.
- Importing a project folder creates or updates a project named after the selected root folder.
- Importing direct files updates the currently active project, or creates a manual project if none exists.
- The active project controls which listings are shown in the popup and used by dashboard fill/copy actions.
- Sync uses the saved folder handle when permission is available. If permission is missing, the user must approve access again.

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
- Never click save/submit after filling localized listing fields.
- Prefer filling fields and showing review state over irreversible actions.
- Keep imported project text local unless the user explicitly exports or submits it.
