# StorePilot

StorePilot is a browser extension for automating repetitive extension-store release work.

The first MVP focuses on Chrome Web Store listing updates:

- Import flat locale listing files such as `en.txt`, `de.txt`, and `pt_BR.txt`.
- Store listing text locally in the browser.
- Show a small helper panel on Chrome Web Store Developer Dashboard pages.
- Copy or fill the selected locale listing text into the active dashboard field.

## Local Development

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this folder:

   `C:\Users\molod\Documents\Personal\settings\StorePilot`

## MVP Workflow

1. Open StorePilot options.
2. Import a folder containing locale text files, for example:

   `store-listing/chrome-web-store/listing/`

3. Open the Chrome Web Store Developer Dashboard.
4. Use the StorePilot panel to select a locale.
5. Copy the listing text or fill the currently focused field.

## Notes

Chrome extensions cannot freely read arbitrary local project folders. The MVP uses a user-selected folder import through a file picker. A future companion CLI or native messaging host can make project discovery automatic.
