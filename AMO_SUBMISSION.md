# AMO Submission Notes

Use this file when submitting StorePilot to Firefox Add-ons.

## Version 1.1.0 Fields

Release Notes:

```text
StorePilot 1.1.0 makes StorePilot Firefox-only and adds store media handling, privacy-form filling, and stronger project import automation.

What's changed:
- Removed the separate Chrome build path and streamlined the project as a Firefox extension.
- Improved project root detection, locale filename parsing, and privacy-document discovery for real project folder layouts.
- Added store media discovery and dashboard upload/clear controls for icon, screenshots, small promo, and marquee promo assets.
- Added draggable, minimizable, closable dashboard panel behavior with clearer grouped controls.
- Added Chrome Web Store privacy-form document discovery and privacy field filling for single purpose, privacy policy URL, host permissions, remote code, and permission justifications.
- Improved parser handling for human-written justification documents, including "Permission Justifications" sections with activeTab/storage headings.
```

Notes to Reviewer:

```text
StorePilot is a local-first extension for browser extension publishers. It imports localized listing text, store media references, and privacy-form text from user-selected local files/folders, then helps fill Chrome Web Store Developer Dashboard fields at the user's request.

Version 1.1.0 changes:
- StorePilot is now maintained as a Firefox extension only; obsolete separate Chrome/Firefox build split files were removed.
- The import scanner detects likely project roots more accurately by looking at common local project markers such as README files, manifests, .git, src, _locales, and store-listing folders. This only affects local user-selected folders.
- Locale filename parsing accepts both underscore and hyphen regional forms, for example pt_BR.txt and pt-BR.txt.
- Fill-all dashboard reporting makes a clearer distinction between imported listing locales, dashboard languages found, locales filled, unsupported locales not offered by the dashboard, and supported imported locales not offered by the dashboard.
- The dashboard panel can be dragged, minimized, closed, reopened from the popup, and constrained to the visible viewport.
- Store media automation can upload and clear reviewable assets to the dashboard, but it enforces the Chrome Web Store five-screenshot limit and does not click final submit/review actions.
- Privacy automation reads a user-selected project document and fills matching Chrome Web Store privacy fields. It uses dashboard data-payload attributes when available and otherwise falls back to label/context matching.

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
- The build copies source files, locales, icons, and manifest into dist, then writes artifacts/storepilot-1.1.0.zip.
- The build script uses System.IO.Compression.ZipArchive instead of PowerShell Compress-Archive so zip entries use forward slashes, which AMO validation requires.

Source package:
- If source code is requested, upload artifacts/source/storepilot-source-1.1.0.zip.
- It was generated with:
  powershell -ExecutionPolicy Bypass -File scripts\build-amo-source.ps1
```

## Add-on Page Fields

Name:

```text
StorePilot
```

Add-on URL slug:

```text
storepilot
```

Summary:

```text
Automate repetitive browser extension store publishing work.
```

Description:

```text
StorePilot helps browser extension developers maintain localized store listings and fill Chrome Web Store Developer Dashboard fields.

Import an extension project root, a store-listing folder, or a direct listing folder containing locale-named files such as en.txt, de.md, or pt_BR.markdown. StorePilot keeps each extension as its own local project, detects listing locales, detects store media assets, scans a privacy-form document when present, and stores imported data only in local browser extension storage.

On the Chrome Web Store Developer Dashboard, StorePilot can fill the current dashboard language, fill all matching dashboard languages with progress and abort support, upload reviewable store media assets, clear media assets, and fill privacy fields from the imported project document.

StorePilot never clicks final submit, publish, or review actions automatically.
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

1. `artifacts/screenshots/01-storepilot-options-projects.png`

Caption:

```text
Import project folders, manage localized listing projects, and preview imported locale text.
```

2. `artifacts/screenshots/02-storepilot-dashboard-panel.png`

Caption:

```text
Use the StorePilot dashboard panel to fill listing fields, upload media, and manage dashboard automation.
```

3. `artifacts/screenshots/03-storepilot-dashboard-popup.png`

Caption:

```text
Select a project from the popup and run dashboard actions without leaving the listing page.
```

## Additional Details

Tags:

```text
translate
user scripts
google
```

Do not use unrelated tags such as ad blocker, privacy, security, vpn, shopping, or video downloader. StorePilot is a publishing/localization workflow tool, and AMO only allows up to 10 tags.

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
artifacts/storepilot-1.1.0.zip
```

## Source Code Upload

Upload this source package when AMO asks for source code:

```text
artifacts/source/storepilot-source-1.1.0.zip
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
Expected output: artifacts/storepilot-1.1.0.zip
```

## Validation Requirements Learned

- Submit `artifacts/storepilot-1.1.0.zip`.
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
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path artifacts\storepilot-1.1.0.zip))
$entries = $zip.Entries | Select-Object -ExpandProperty FullName
if ($entries | Where-Object { $_ -match '\\' }) { throw 'zip contains backslash paths' }
$zip.Dispose()
```

4. Upload extension package:

```text
artifacts/storepilot-1.1.0.zip
```

5. Upload source package if AMO asks for source code:

```text
artifacts/source/storepilot-source-1.1.0.zip
```
