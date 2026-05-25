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
- Let the user copy listing text for the selected project locale from the popup.
- Detect and explain Chrome's extension-gallery scripting restriction when fill actions target Chrome Web Store pages.
- Do not claim current Chrome Web Store dashboard locale detection; persist manual locale selection per project instead.

## Non-Goals for MVP

- No automatic submission click.
- No credential handling.
- No unrestricted local filesystem access.
- No remote sync.
- No automatic publishing API integration yet.
- No Chrome Web Store dashboard DOM automation from the extension itself, because Chrome blocks extension scripts on Web Store pages.

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
- External browser automation or native companion for dashboard UI automation if the API cannot cover listing fields.
- Firefox AMO and Edge Add-ons support.

## Safety Rules

- Never click final submit/publish automatically without explicit user action.
- Never click save/submit after filling localized listing fields.
- Prefer filling fields and showing review state over irreversible actions.
- Keep imported project text local unless the user explicitly exports or submits it.
