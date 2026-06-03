# AMO Submission Notes

Use this file when submitting StorePilot to Firefox Add-ons.

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
StorePilot helps browser extension developers maintain localized store listings and fill Chrome Web Store Developer Dashboard language fields from Firefox.

Import an extension project root, a store-listing folder, or a direct listing folder containing locale-named files such as en.txt, de.md, or pt_BR.markdown. StorePilot keeps each extension as its own local project, detects listing locales, and stores imported listing text only in local browser extension storage.

From the Chrome Web Store Developer Dashboard opened in Firefox, StorePilot can fill the current dashboard language or fill all matching dashboard languages with progress, abort, retry, and clear failure reporting.

Chrome itself blocks extensions from scripting Chrome Web Store pages, so StorePilot is Firefox-first for dashboard automation.
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

StorePilot has no analytics, no tracking, no telemetry, and no remote server. Imported listing text, project metadata, preferences, and folder permissions are stored only in the browser's local extension storage on your device.

StorePilot only uses its requested permissions to:

- Store imported listing text and project settings locally.
- Read user-selected listing files or folders after browser confirmation.
- Run on Chrome Web Store Developer Dashboard pages so it can fill listing fields at the user's request.

StorePilot does not sell, share, or transfer user data to third parties.
```

## Screenshots

Upload screenshots in this order:

1. `artifacts/screenshots/01-storepilot-options-projects.png`

Caption:

```text
Import project folders, manage localized listing projects, and preview imported locale text.
```

2. `artifacts/screenshots/02-storepilot-dashboard-mini-panel.png`

Caption:

```text
Use the StorePilot mini panel on the Chrome Web Store dashboard to fill the current language or all matching languages.
```

3. `artifacts/screenshots/03-storepilot-dashboard-popup.png`

Caption:

```text
Select a project from the popup and run dashboard fill actions without leaving the listing page.
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

The extension stores imported listing text locally and uses Chrome Web Store Developer Dashboard host permissions only so the user can fill listing fields while the dashboard is open in Firefox.

StorePilot has no analytics, tracking, telemetry, remote server, or off-device data transmission.
```

UUID:

```text
storepilot@molodchyk.dev
```

Whiteboard:

```text

```

## Notes To Reviewer

```text
StorePilot is a Firefox-first extension for browser extension publishers. It imports localized listing text from user-selected local files/folders and can fill Chrome Web Store Developer Dashboard language fields when that dashboard is opened in Firefox.

Privacy/data:
- StorePilot has no analytics, tracking, telemetry, remote server, or off-device data transmission.
- Imported listing text, project metadata, preferences, and folder permissions are stored only in local browser extension storage / browser-managed local handles.
- The Firefox manifest declares browser_specific_settings.gecko.data_collection_permissions.required = ["none"].

Why Chrome Web Store host permissions are requested:
- StorePilot runs on https://chrome.google.com/webstore/devconsole/* and https://chromewebstore.google.com/devconsole/* so it can fill listing fields at the user's request.
- Chrome itself blocks Chrome extensions from scripting Chrome Web Store pages, so the automated dashboard workflow is intentionally implemented for Firefox.

Build:
- Source is not bundled, minified, transpiled, or obfuscated.
- The submitted zip is built from this repository with:
  powershell -ExecutionPolicy Bypass -File scripts\build-firefox.ps1
- The build copies shared source into dist-firefox, applies Firefox-only overrides from src-firefox, copies _locales, and writes artifacts/firefox/storepilot-firefox-1.0.1.zip.
- The build script uses System.IO.Compression.ZipArchive instead of PowerShell Compress-Archive so zip entries use forward slashes, which AMO validation requires.
```

## Source Code Question

For the AMO question "Do you use any of the following in your extension?", answer:

```text
Yes
```

Reason: StorePilot is not bundled, minified, transpiled, or obfuscated, but the submitted Firefox zip is generated by `scripts/build-firefox.ps1`. That script copies files, applies Firefox-specific overrides, copies locales/icons, and writes the final package. Mozilla's wording includes any tool that takes code or files, applies processing, and generates files included in the extension.

Use this build instruction when AMO asks how to reproduce the submitted package:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-firefox.ps1
```

Expected output:

```text
artifacts/firefox/storepilot-firefox-1.0.1.zip
```

## Source Code Upload

Upload this source package when AMO asks for source code:

```text
artifacts/source/storepilot-source-1.0.1.zip
```

Create it with:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-amo-source.ps1
```

The source package is generated from `git ls-files`, so it includes repository source files and excludes ignored generated output such as `dist-firefox/`, `artifacts/`, and `.git/`.

Build environment requirements for the reviewer:

```text
Operating system: Windows 10/11 or any Windows environment with Windows PowerShell 5.1+ or PowerShell 7+.
Required programs: PowerShell and Git.
Node.js/npm: not required to build the submitted extension package.
External dependencies: none.
Build command: powershell -ExecutionPolicy Bypass -File scripts\build-firefox.ps1
Expected output: artifacts/firefox/storepilot-firefox-1.0.1.zip
```

## Validation Requirements Learned

- Submit `artifacts/firefox/storepilot-firefox-1.0.1.zip`, not a root-level zip.
- AMO rejects zip entries with Windows backslashes, for example `src\firefox-background.js`. The build script must preserve forward-slash archive names such as `src/firefox-background.js`.
- Firefox requires `browser_specific_settings.gecko.data_collection_permissions` for new extensions.
- StorePilot should declare:

```json
"data_collection_permissions": {
  "required": ["none"]
}
```

- Because `data_collection_permissions` is supported by Firefox desktop 140+ and Firefox for Android 142+, the Firefox manifest uses:

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
.\scripts\build-firefox.ps1
```

2. Create the source upload package:

```powershell
.\scripts\build-amo-source.ps1
```

3. Verify the extension artifact:

```powershell
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path artifacts\firefox\storepilot-firefox-1.0.1.zip))
$entries = $zip.Entries | Select-Object -ExpandProperty FullName
if ($entries | Where-Object { $_ -match '\\' }) { throw 'zip contains backslash paths' }
$zip.Dispose()
```

4. Upload extension package:

```text
artifacts/firefox/storepilot-firefox-1.0.1.zip
```

5. Upload source package if AMO asks for source code:

```text
artifacts/source/storepilot-source-1.0.1.zip
```
