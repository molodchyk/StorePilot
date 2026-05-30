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
- The build copies shared source into dist-firefox, applies Firefox-only overrides from src-firefox, copies _locales, and writes artifacts/firefox/storepilot-firefox-1.0.0.zip.
- The build script uses System.IO.Compression.ZipArchive instead of PowerShell Compress-Archive so zip entries use forward slashes, which AMO validation requires.
```

## Validation Requirements Learned

- Submit `artifacts/firefox/storepilot-firefox-1.0.0.zip`, not a root-level zip.
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

2. Verify the artifact:

```powershell
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path artifacts\firefox\storepilot-firefox-1.0.0.zip))
$entries = $zip.Entries | Select-Object -ExpandProperty FullName
if ($entries | Where-Object { $_ -match '\\' }) { throw 'zip contains backslash paths' }
$zip.Dispose()
```

3. Upload:

```text
artifacts/firefox/storepilot-firefox-1.0.0.zip
```
