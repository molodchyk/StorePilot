# StorePilot: Chrome Web Store Listing Autofill

StorePilot is a local-first Firefox extension for autofilling Chrome Web Store listing fields, localized descriptions, screenshots, and privacy forms from local project files.

## What It Does

- Imports locale-named listing text files such as `en`, `de`, and `pt_BR` files.
- Detects listing folders inside project roots, `store-listing` folders, and direct listing folders.
- Keeps multiple extension projects separate.
- Stores listing text, media metadata, privacy-form text, preferences, and folder handles locally.
- Lets the user select an active project from options, popup, project rows, or the dashboard panel.
- Fills the current Chrome Web Store dashboard language.
- Fills all matching dashboard languages with progress, abort, retry, and named failure reporting.
- Uploads discovered store media assets for screenshots, icon, small promo, and marquee promo where the dashboard allows it.
- Fills Chrome Web Store privacy-form text from a detected project privacy document.

## Local Development

Build the extension package:

```powershell
.\scripts\build.ps1
```

Load it temporarily:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `dist/manifest.json`.

The build also creates:

```text
artifacts/storepilot-1.1.1.zip
```

AMO source-code upload package:

```powershell
.\scripts\build-amo-source.ps1
```

This creates:

```text
artifacts/source/storepilot-source-1.1.1.zip
```

## Current Workflow

1. Build and load StorePilot.
2. Open StorePilot options.
3. Import an extension project root, a `store-listing` folder, or a direct listing folder.
4. Select the active project.
5. Open the Chrome Web Store Developer Dashboard.
6. Use the dashboard panel or popup to fill listing fields, upload media, clear media, or fill privacy fields.

StorePilot never clicks final submit, publish, or review actions automatically.

## More Docs

- [PROJECT_SCOPE_AND_PHILOSOPHY.md](PROJECT_SCOPE_AND_PHILOSOPHY.md): product boundaries, design intent, and safety principles.
- [SPECIFICATIONS.md](SPECIFICATIONS.md): implementation details, data model, build flow, dashboard automation, and future-Codex context.
- [AMO_SUBMISSION.md](AMO_SUBMISSION.md): Firefox Add-ons submission fields, reviewer notes, and validation gotchas.

## Privacy

StorePilot does not collect or transmit data off your device. It has no analytics, no tracking, and no remote server; imported listings are stored only in local browser extension storage.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Support

If this extension saves you time and you want to support its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/molodchyk)
[![Patreon](https://img.shields.io/badge/Patreon-support-F96854?logo=patreon&logoColor=fff)](https://www.patreon.com/OMolodchyk)

## License

This project is licensed under the GNU General Public License v3.0 or later. See [LICENSE.txt](LICENSE.txt) for details.
