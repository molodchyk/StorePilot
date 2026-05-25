# StorePilot

StorePilot is a browser extension for automating repetitive extension-store release work.

The first MVP focuses on Chrome Web Store listing updates:

- Import flat locale listing files such as `en.txt`, `de.txt`, and `pt_BR.txt`.
- Keep separate projects for different extensions.
- Store listing text locally in the browser per project.
- Remember selected project folders and sync listings again when Chrome still has permission.
- Copy selected locale listing text from the popup for pasting into store dashboards.

## Local Development

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this folder:

   `C:\Users\molod\Documents\Personal\settings\StorePilot`

## Firefox Distribution

The Firefox build is intended to test whether Firefox can script the Chrome Web Store dashboard where Chrome blocks itself.

Build the Firefox distribution:

```powershell
.\scripts\build-firefox.ps1
```

Then open Firefox, go to `about:debugging#/runtime/this-firefox`, choose **Load Temporary Add-on**, and select:

`C:\Users\molod\Documents\Personal\settings\StorePilot\dist-firefox\manifest.json`

The build script also creates:

`C:\Users\molod\Documents\Personal\settings\StorePilot\storepilot-firefox-0.1.0.zip`

Firefox does not support the same folder-handle sync workflow as Chrome. For first tests, import listing files directly from the popup/options, then open the Chrome Web Store Developer Dashboard in Firefox and try **Fill current language** or **Fill all languages**.

## MVP Workflow

1. Open StorePilot options or the StorePilot popup.
2. Import an extension project root, a store-listing folder, or direct locale listing files. StorePilot detects locale-named listing files such as `en.txt`, `de.md`, and `pt_BR.markdown`.

3. Switch the active project in the popup/options when working on another extension.
4. Use **Sync project** or **Sync all** to refresh listings from saved folders.
5. Open the Chrome Web Store Developer Dashboard.
6. Select a locale in StorePilot.
7. Copy the listing text and paste it into the dashboard field.

## Notes

Chrome extensions cannot freely read arbitrary local project folders. StorePilot stores user-selected folder handles and can sync again while Chrome still grants permission. If permission expires, choose the project folder again or click sync and approve access.

Chrome also blocks extension scripts on Chrome Web Store pages with `The extensions gallery cannot be scripted.` That means a normal Chrome extension cannot automate the Chrome Web Store dashboard UI directly. StorePilot can still manage projects, sync listing files, and copy localized text for manual paste in Chrome. The Firefox distribution is an experiment to run the same dashboard automation from Firefox, where Chrome's own extension-gallery block does not apply.

Because of the same restriction, StorePilot cannot detect the currently selected Chrome Web Store dashboard locale. Select the locale in StorePilot manually; the popup remembers the selected locale per project.
