# AMO Submission Notes

Use this file when submitting StorePilot to Firefox Add-ons.

## Version 1.1.1 Fields

Release Notes:

```text
StorePilot 1.1.1 improves discoverability and Firefox locale coverage.

What's changed:
- Renamed the public add-on title to "StorePilot: Chrome Web Store Listing Autofill" so developers can find it by the actual task it performs.
- Rewrote the manifest summary and AMO page description around Chrome Web Store listing autofill, localized descriptions, screenshots, and privacy forms.
- Localized the manifest-facing add-on name and summary across all packaged locale directories.
- Added sparse locale files for AMO-visible Firefox locales that were missing from the previous package.
- No permissions, data collection behavior, host permissions, or automatic submit/review behavior changed.
```

Notes to Reviewer:

```text
StorePilot is a local-first extension for browser extension publishers. It imports localized listing text, store media references, and privacy-form text from user-selected local files/folders, then helps fill Chrome Web Store Developer Dashboard fields at the user's request.

Version 1.1.1 changes:
- The public manifest name and summary now target Chrome Web Store listing autofill searches.
- AMO page copy was rewritten to describe listing-field autofill, localized descriptions, screenshots/media, and privacy forms directly.
- Localized the manifest-facing add-on name and summary for every packaged locale directory.
- Filled the full extension UI message set for translation-supported packaged locale directories.
- Added locale files for dsb, en_CA, en_GB, en_US, es_AR, es_CL, es_ES, es_MX, fur, fy_NL, he, hsb, ia, ka, kab, nb_NO, nn_NO, sq, and sv_SE. Translation-supported additions now include the full UI message set; dsb, hsb, ia, and kab keep English fallback UI strings beyond localized manifest metadata.
- No extension permissions, host permissions, remote-code behavior, data collection behavior, or final submit/review behavior changed.

Privacy/data:
- StorePilot has no analytics, tracking, telemetry, remote server, or off-device data transmission.
- Imported listing text, media references, privacy-form text, project metadata, preferences, and folder permissions are stored only in local browser extension storage / browser-managed local handles.
- The manifest declares browser_specific_settings.gecko.data_collection_permissions.required = ["none"].

Why Chrome Web Store host permissions are requested:
- StorePilot runs on https://chrome.google.com/webstore/devconsole/* and https://chromewebstore.google.com/devconsole/* so it can fill dashboard fields and upload reviewable media at the user's request.

Build:
- Source is not bundled, minified, transpiled, or obfuscated.
- The submitted zip is built from this repository with:
  powershell -ExecutionPolicy Bypass -File scripts\build.ps1
- The build copies source files, locales, icons, and manifest into dist, then writes artifacts/storepilot-1.1.1.zip.
- The build script uses System.IO.Compression.ZipArchive instead of PowerShell Compress-Archive so zip entries use forward slashes, which AMO validation requires.

Source package:
- If source code is requested, upload artifacts/source/storepilot-source-1.1.1.zip.
- It was generated with:
  powershell -ExecutionPolicy Bypass -File scripts\build-amo-source.ps1
```

## Add-on Page Fields

Name:

```text
StorePilot: Chrome Web Store Listing Autofill
```

Add-on URL slug:

```text
storepilot
```

Summary:

```text
Autofill Chrome Web Store listing fields, localized descriptions, screenshots, and privacy forms from local files.
```

Description:

```text
StorePilot: Chrome Web Store Listing Autofill helps browser extension developers fill Chrome Web Store Developer Dashboard listing fields from local project files instead of copy-pasting every locale by hand.

Import an extension project root, a store-listing folder, or a direct listing folder containing locale-named listing text files such as en, de, or pt_BR. StorePilot keeps each extension as its own local project, detects localized descriptions, screenshots, icons, promo tiles, and privacy-form text, and stores imported data only in local browser extension storage.

On the Chrome Web Store Developer Dashboard, StorePilot can autofill the current listing language, fill all matching listing languages with progress and abort support, upload screenshots and other reviewable store media, clear uploaded media, and fill privacy fields from the imported project document.

StorePilot never clicks final submit, publish, or review actions automatically.
```

Search/SEO notes:

```text
The previous name/summary only matched users who already knew "StorePilot" or searched broadly for browser extension publishing. The public title and summary now include exact intent phrases: Chrome Web Store, listing, listing fields, autofill, localized descriptions, screenshots, privacy forms, and Developer Dashboard.
```

Experimental:

```text
No
```

Requires payment, non-free services/software, or additional hardware:

```text
No
```

Categories:

```text
Web Development
Language Support
```

If AMO requires a third category, use:

```text
My add-on doesn't fit into any of the categories
```

Support email:

```text
molodchykr@gmail.com
```

Support website:

```text
https://github.com/molodchyk/StorePilot/issues
```

License:

```text
Other: GNU General Public License v3.0 or later
```

If AMO does not allow custom license text at submission time, select `GNU General Public License v3.0 only` only if the project has intentionally been changed from `GPL-3.0-or-later` to `GPL-3.0-only`.

Privacy Policy:

```text
StorePilot does not collect or transmit data off your device.

StorePilot has no analytics, no tracking, no telemetry, and no remote server. Imported listing text, media references, privacy-form text, project metadata, preferences, and folder permissions are stored only in the browser's local extension storage on your device.

StorePilot only uses its requested permissions to:

- Store imported project data and settings locally.
- Read user-selected listing files or folders after browser confirmation.
- Run on Chrome Web Store Developer Dashboard pages so it can fill fields and upload reviewable media at the user's request.

StorePilot does not sell, share, or transfer user data to third parties.
```

## Screenshots

Upload screenshots in this order:

1. `artifacts/screenshots/01-storepilot-options-project-overview.png`

Caption:

```text
Manage imported projects, review detected listing locales, media assets, privacy documents, and project source status.
```

2. `artifacts/screenshots/02-storepilot-listing-dashboard-panel.png`

Caption:

```text
Fill listing languages and manage uploaded store media directly from the Chrome Web Store dashboard panel.
```

3. `artifacts/screenshots/03-storepilot-media-assets-preview.png`

Caption:

```text
Review detected store icons, screenshots, small promo tiles, and marquee promo tiles before uploading.
```

4. `artifacts/screenshots/04-storepilot-privacy-dashboard-panel.png`

Caption:

```text
Fill Chrome Web Store privacy fields from a detected project privacy document.
```

5. `artifacts/screenshots/05-storepilot-dashboard-popup.png`

Caption:

```text
Select a project from the popup and run page-specific dashboard actions without leaving the store page.
```

## Additional Details

Tags:

```text
chrome web store
developer tools
autofill
form filler
store listing
extension publishing
localization
screenshots
privacy form
google
```

Do not use unrelated tags such as ad blocker, privacy, security, vpn, shopping, or video downloader. StorePilot is a publishing/localization workflow tool, and AMO only allows up to 10 tags.

## Language Coverage Notes

Firefox/WebExtension locale fallback lets sparse locale files provide only add-on name, summary, and language name while missing UI messages fall back to the default locale. StorePilot now has localized manifest-facing add-on names and summaries for all packaged locale directories, and full UI message coverage for translation-supported packaged locales.

AMO-visible Firefox locale gaps added in this repo:

```text
dsb, en_CA, en_GB, en_US, es_AR, es_CL, es_ES, es_MX, fur, fy_NL, he, hsb, ia, ka, kab, nb_NO, nn_NO, sq, sv_SE
```

The packaged `dsb`, `hsb`, `ia`, and `kab` locale files keep English fallback UI strings beyond the localized manifest metadata because no safe translation-backend target was available for those locale codes. Firefox supports additional browser UI locales that are still not included here. Do not add the full remaining set as English-only placeholders unless there is a release reason; add them when there are real translated summary/UI strings or a clear user signal.

Contributions URL:

```text
https://buymeacoffee.com/molodchyk
```

Alternative supported contribution URL:

```text
https://www.patreon.com/OMolodchyk
```

Default Locale:

```text
English (US)
```

Homepage:

```text
https://github.com/molodchyk/StorePilot
```

Developer Comments:

```text
StorePilot is built for browser extension publishers who maintain localized Chrome Web Store listings.

The extension stores imported project data locally and uses Chrome Web Store Developer Dashboard host permissions only so the user can fill fields and upload reviewable media while the dashboard is open.

StorePilot has no analytics, tracking, telemetry, remote server, or off-device data transmission.
```

UUID:

```text
storepilot@molodchyk.dev
```

## Source Code Question

For the AMO question "Do you use any of the following in your extension?", answer:

```text
Yes
```

Reason: StorePilot is not bundled, minified, transpiled, or obfuscated, but the submitted zip is generated by `scripts/build.ps1`. That script copies files and writes the final package. Mozilla's wording includes any tool that takes code or files, applies processing, and generates files included in the extension.

Use this build instruction when AMO asks how to reproduce the submitted package:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build.ps1
```

Expected output:

```text
artifacts/storepilot-1.1.1.zip
```

## Source Code Upload

Upload this source package when AMO asks for source code:

```text
artifacts/source/storepilot-source-1.1.1.zip
```

Create it with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-amo-source.ps1
```

The source package is generated from `git ls-files`, so it includes repository source files and excludes ignored generated output such as `dist/`, `dist-next/`, `artifacts/`, and `.git/`.

Build environment requirements for the reviewer:

```text
Operating system: Windows 10/11 or any Windows environment with Windows PowerShell 5.1+ or PowerShell 7+.
Required programs: PowerShell and Git.
Node.js/npm: not required to build the submitted extension package.
External dependencies: none.
Build command: powershell -ExecutionPolicy Bypass -File scripts\build.ps1
Expected output: artifacts/storepilot-1.1.1.zip
```

## Validation Requirements Learned

- Submit `artifacts/storepilot-1.1.1.zip`.
- AMO rejects zip entries with Windows backslashes. The build script must preserve forward-slash archive names such as `src/background.js`.
- The manifest declares:

```json
"data_collection_permissions": {
  "required": ["none"]
}
```

- Because `data_collection_permissions` is supported by Firefox desktop 140+ and Firefox for Android 142+, the manifest uses:

```json
"browser_specific_settings": {
  "gecko": {
    "strict_min_version": "140.0"
  },
  "gecko_android": {
    "strict_min_version": "142.0"
  }
}
```

- If AMO validation passes with warnings, inspect whether the warnings come from unsupported manifest keys and update minimum versions before final submission.

## Release Checklist

1. Run:

```powershell
.\scripts\build.ps1
```

2. Create the source upload package:

```powershell
.\scripts\build-amo-source.ps1
```

3. Verify the extension artifact:

```powershell
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path artifacts\storepilot-1.1.1.zip))
$entries = $zip.Entries | Select-Object -ExpandProperty FullName
if ($entries | Where-Object { $_ -match '\\' }) { throw 'zip contains backslash paths' }
$zip.Dispose()
```

4. Upload extension package:

```text
artifacts/storepilot-1.1.1.zip
```

5. Upload source package if AMO asks for source code:

```text
artifacts/source/storepilot-source-1.1.1.zip
```
