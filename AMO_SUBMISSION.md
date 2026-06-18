# AMO Submission Notes

Use this file when submitting StorePilot to Firefox Add-ons.

## Version 1.3.0.1 Fields

Release Notes:

```text
StorePilot 1.3.0.1 re-uploads the 1.3.0 feature release after an AMO submission glitch. It adds Chrome Web Store category, Additional fields, and Data usage disclosure automation, plus clearer release-prep project structure guidance.

What's changed:
- Project imports can now detect docs/chrome-web-store-category.md with an explicit Selected category line.
- The popup and dashboard panel can select the matching Chrome Web Store category at the user's request.
- Project imports can now detect docs/chrome-web-store-additional-fields.md for Official URL, Homepage URL, Support URL, and Mature content values.
- The popup and dashboard panel can fill detected Chrome Web Store Additional fields at the user's request.
- The options page Product Details view now shows imported description text plus the detected category, source file, reason, and scan counts.
- The options page Additional Fields view shows detected values, source file, and scan counts so users can verify them before filling the dashboard.
- The options page Data Usage view shows detected Data usage and certification values so users can verify them before filling the privacy page.
- The popup and dashboard panel include Fill data usage on the Chrome Web Store Privacy page; it only checks boxes with explicit yes values in the imported privacy document.
- The Chrome Web Store Privacy fill action now treats remote_code as the dashboard Yes/No remote-code radio and fills remote_code_justification only when remote_code is yes.
- Chrome Web Store graphic assets are now labeled as Graphic Assets in StorePilot to match the dashboard terminology.
- The primary listing action is labeled Fill descriptions, while the old current-language filler is hidden behind an advanced preference for debugging/manual fallback use.
- Additional Fields now appears after Graphic Assets in options, popup, and dashboard panel ordering to match the Chrome Web Store page.
- The built-in project reference now documents one-language project layout, listing text, category, Additional fields, graphic assets, and privacy automation files, including that Data usage values are public disclosure decisions rather than permission justifications.
- No permissions, data collection behavior, host permissions, or automatic submit/review behavior changed.
```

Notes to Reviewer:

```text
StorePilot is a local-first tool for extension publishers. It imports user-selected local project files/folders (localized listing text, CWS category, Additional fields, graphic asset references, privacy-form text, and Data usage choices) and helps fill CWS Developer Dashboard fields only when the user clicks an action.

Version 1.3.0.1 reviewer notes:
- Adds category detection from docs/chrome-web-store-category.md and Select category on Chrome Web Store listing pages.
- Adds Additional fields detection from docs/chrome-web-store-additional-fields.md for Official URL, Homepage URL, Support URL, and Mature content; Fill additional fields fills those controls from explicit imported values.
- Adds a Data Usage options view and Fill data usage action for the CWS Privacy page. It maps the 9 Data usage categories and 3 certification boxes by section/order, checks explicit yes values, and unchecks explicit no values.
- Updates Privacy fill: remote_code now drives the Yes/No remote-code radio; remote_code_justification is filled only when remote_code is yes.
- Renames Store media UI to Graphic Assets, changes the main listing action to Fill descriptions, hides Fill current language behind an advanced preference, and orders Additional Fields after Graphic Assets.
- Adds CWS item-id project binding so two open dashboard tabs can keep different StorePilot project contexts.
- Adds reference docs for one-language project layouts, detailed description files, category, Additional fields, graphic assets, privacy, and Data usage disclosure decisions.
- No extension permissions, host permissions, remote-code behavior, data collection behavior, or final submit/review behavior changed. StorePilot never clicks final submit/publish/review.

Privacy/data:
- No analytics, tracking, telemetry, remote server, or off-device data transmission.
- Imported content, project metadata, preferences, and folder permissions stay in local browser extension storage / browser-managed local handles.
- Manifest declares browser_specific_settings.gecko.data_collection_permissions.required = ["none"].
- Host permissions for chrome.google.com/webstore/devconsole/* and chromewebstore.google.com/devconsole/* are used only to fill CWS dashboard fields and upload reviewable media at the user's request.

Build/source:
- Source is not bundled, minified, transpiled, or obfuscated.
- Build command: powershell -ExecutionPolicy Bypass -File scripts\build.ps1
- Expected extension package: artifacts/storepilot-1.3.0.1.zip
- The build copies source, locales, icons, and manifest into dist, then creates the zip with forward-slash archive entries for AMO validation.
- If source code is requested, upload artifacts/source/storepilot-source-1.3.0.1.zip, generated with: powershell -ExecutionPolicy Bypass -File scripts\build-amo-source.ps1
- Source package uses git ls-files, so generated/untracked local files are excluded.
```

## Add-on Page Fields

Name:

```text
StorePilot: Chrome Web Store Automation
```

Add-on URL slug:

```text
storepilot
```

Summary:

```text
Automate Chrome extension store listings: autofill Chrome Web Store fields, descriptions, screenshots, additional fields, and privacy forms.
```

Description:

```text
StorePilot: Chrome Web Store Automation helps browser extension developers automate Chrome extension store listings by autofilling Chrome Web Store Developer Dashboard fields from local project files instead of copy-pasting every locale by hand.

Import an extension project root, a store-listing folder, or a direct listing folder containing locale-named listing text files such as en, de, or pt_BR. StorePilot keeps each extension as its own local project, detects localized descriptions, category decisions, Additional fields values, screenshots, icons, promo tiles, and privacy-form text, and stores imported data only in local browser extension storage.

On the Chrome Web Store Developer Dashboard, StorePilot can fill matching detailed description fields with progress and abort support, select the imported category, upload screenshots and other reviewable graphic assets, clear uploaded assets, fill Additional fields, and fill privacy fields from the imported project document. A hidden-by-default advanced preference can expose the current-language filler for debugging or one-off manual fills.

StorePilot never clicks final submit, publish, or review actions automatically.
```

Search/SEO notes:

```text
AMO API checks after 1.1.1 showed StorePilot ranked #1 for "chrome web store listing autofill" but did not appear for "chrome extension store automate". The current English title and summary include broader exact-intent phrases: Chrome Web Store, automate, Chrome extension store listings, autofill, descriptions, screenshots, additional fields, privacy forms, and Developer Dashboard.

Live AMO tags after 1.1.1 were still google, translate, user scripts. Update the Tags field manually before or after upload.

Live AMO API also reported is_noindexed=true. If that remains after metadata and tag changes, check Developer Hub listing visibility/noindex settings or contact AMO support.
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

StorePilot has no analytics, no tracking, no telemetry, and no remote server. Imported listing text, category decisions, Additional fields values, media references, privacy-form text, project metadata, preferences, and folder permissions are stored only in the browser's local extension storage on your device.

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
Manage imported projects, review detected listing locales, category, Additional fields, graphic assets, privacy documents, and project source status.
```

2. `artifacts/screenshots/02-storepilot-listing-dashboard-panel.png`

Caption:

```text
Fill listing languages, select category, fill Additional fields, and manage uploaded graphic assets directly from the Chrome Web Store dashboard panel.
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
automation
```

Do not use unrelated tags such as ad blocker, privacy, security, vpn, shopping, or video downloader. StorePilot is a publishing/localization workflow tool, and AMO only allows up to 10 tags.

After uploading 1.3.0.1, confirm the AMO API tags use the set above instead of the old `google`, `translate`, and `user scripts` set.

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
artifacts/storepilot-1.3.0.1.zip
```

## Source Code Upload

Upload this source package when AMO asks for source code:

```text
artifacts/source/storepilot-source-1.3.0.1.zip
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
Expected output: artifacts/storepilot-1.3.0.1.zip
```

## Validation Requirements Learned

- Submit `artifacts/storepilot-1.3.0.1.zip`.
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
.\scripts\test-amo-submission.ps1
```

2. Build:

```powershell
.\scripts\build.ps1
```

3. Create the source upload package:

```powershell
.\scripts\build-amo-source.ps1
```

4. Verify the extension artifact:

```powershell
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead((Resolve-Path artifacts\storepilot-1.3.0.1.zip))
$entries = $zip.Entries | Select-Object -ExpandProperty FullName
if ($entries | Where-Object { $_ -match '\\' }) { throw 'zip contains backslash paths' }
$zip.Dispose()
```

5. Upload extension package:

```text
artifacts/storepilot-1.3.0.1.zip
```

6. Upload source package if AMO asks for source code:

```text
artifacts/source/storepilot-source-1.3.0.1.zip
```
