# StorePilot

StorePilot is a browser extension for automating repetitive extension-store release work.

The first MVP focuses on Chrome Web Store listing updates:

- Import flat locale listing files such as `en.txt`, `de.txt`, and `pt_BR.txt`.
- Keep separate projects for different extensions.
- Store listing text locally in the browser per project.
- Remember selected project folders and sync listings again when Chrome still has permission.
- Show a small helper panel on Chrome Web Store Developer Dashboard pages.
- Copy or fill the selected locale listing text into the active dashboard field.
- Fill the Chrome Web Store description for the current dashboard language.
- Iterate through Chrome Web Store language dropdown entries and fill all matching imported locales.

## Local Development

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this folder:

   `C:\Users\molod\Documents\Personal\settings\StorePilot`

## MVP Workflow

1. Open StorePilot options or the StorePilot popup.
2. Import an extension project root, a store-listing folder, or direct locale listing files. StorePilot detects locale-named listing files such as `en.txt`, `de.md`, and `pt_BR.markdown`.

3. Switch the active project in the popup/options when working on another extension.
4. Use **Sync project** or **Sync all** to refresh listings from saved folders.
5. Open the Chrome Web Store Developer Dashboard.
6. Use the StorePilot panel to select a locale.
7. Copy the listing text, fill the currently focused field, fill the current dashboard language, or fill all matching dashboard languages.

## Notes

Chrome extensions cannot freely read arbitrary local project folders. StorePilot stores user-selected folder handles and can sync again while Chrome still grants permission. If permission expires, choose the project folder again or click sync and approve access.
