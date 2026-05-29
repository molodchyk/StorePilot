# StorePilot

StorePilot is a local-first browser extension for maintaining localized browser-extension store listings. It imports flat locale files from extension projects, keeps each extension as a separate project, and helps fill Chrome Web Store listing fields from Firefox.

The current working distribution is Firefox-first. Chrome can still import, organize, sync, and copy listing text, but Chrome cannot automate the Chrome Web Store dashboard UI because Chrome blocks extensions from scripting Chrome extension gallery pages.

## What It Does

- Imports locale listing files such as `en.txt`, `de.md`, and `pt_BR.markdown`.
- Detects listing folders inside project roots, `store-listing` folders, and direct listing folders.
- Keeps multiple extension projects separate.
- Canonicalizes Firefox imports so subfolders of the same extension do not become noisy duplicate projects.
- Stores listing text locally in extension storage.
- Lets the user select an active project from options, popup, or clickable project rows.
- Fills the current Chrome Web Store dashboard language from Firefox.
- Fills all matching dashboard languages from Firefox, with progress, abort, retry, and named failure reporting.

## Why Chrome Dashboard Automation Does Not Work

Chrome intentionally blocks extensions from injecting scripts into Chrome Web Store pages, including the developer dashboard. Attempts to run content scripts there fail with an error like:

```text
The extensions gallery cannot be scripted.
```

That means a normal Chrome extension cannot reliably inspect or automate the Chrome Web Store Developer Dashboard UI. StorePilot's Chrome build can still manage projects and copy localized text for manual paste, but it cannot safely implement `Fill current language` or `Fill all languages` on Chrome Web Store pages.

The Firefox distribution exists because Firefox is not subject to Chrome's self-protection rule. Running StorePilot in Firefox against `https://chrome.google.com/webstore/devconsole/...` lets the extension inject the dashboard helper and automate listing fields.

## Local Development

Chrome development build:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select this repository folder.

Firefox distribution build:

```powershell
.\scripts\build-firefox.ps1
```

Then open Firefox:

1. Go to `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `dist-firefox/manifest.json`.

The build also creates:

```text
storepilot-firefox-0.1.0.zip
```

## Firefox Build Notes

Firefox is built from shared `src` files, then patched by `src-firefox/apply-firefox-overrides.ps1`.

Important Firefox-only pieces:

- `src-firefox/firefox-background.js`: handles opening options and action behavior.
- `src-firefox/firefox-import-ui.js`: removes Chrome-only popup/options controls and guides users to options for import.
- `src-firefox/firefox-project-overrides.js`: canonicalizes project identity and merges duplicate imports.
- `src-firefox/icons/*.png`: Firefox extension icons copied into `dist-firefox/src/icons`.
- `manifest.firefox.json`: Firefox manifest source.

If a behavior looks fixed in `src` but not in Firefox, check whether `apply-firefox-overrides.ps1` rewrites that part during build. This matters especially for `src/content/dashboard-helper.js`, because Firefox currently patches the mini panel rendering.

## Current Workflow

1. Build and load the Firefox distribution.
2. Open StorePilot options.
3. Import an extension project root, a `store-listing` folder, or a direct listing folder.
4. Select the active project from the dropdown or clickable Projects rows.
5. Open the Chrome Web Store Developer Dashboard in Firefox.
6. Use the mini panel or popup:
   - **Fill current** fills the visible dashboard language.
   - **Fill all** iterates through matching dashboard language options.
   - **Abort** stops after the current dashboard step.

## More Docs

- [PROJECT_SCOPE_AND_PHILOSOPHY.md](PROJECT_SCOPE_AND_PHILOSOPHY.md): product boundaries, design intent, and safety principles.
- [SPECIFICATIONS.md](SPECIFICATIONS.md): implementation details, data model, build flow, browser constraints, and future-Codex context.

## Privacy

StorePilot does not collect or transmit data off your device. It has no analytics, no tracking, and no remote server; imported listings are stored only in local browser extension storage.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Support

If this extension saves you time and you want to support its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/molodchyk)
[![Patreon](https://img.shields.io/badge/Patreon-support-F96854?logo=patreon&logoColor=fff)](https://www.patreon.com/OMolodchyk)

## License

This project is licensed under the GNU General Public License v3.0 or later. See [LICENSE.txt](LICENSE.txt) for details.
