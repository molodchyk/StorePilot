# StorePilot: Chrome Web Store Automation

StorePilot is a local-first Firefox extension for automating Chrome extension store listings by autofilling Chrome Web Store fields, descriptions, screenshots, additional product fields, and privacy forms from local project files.

## What It Does

- Imports locale-named detailed description files such as `en.md`, `de.md`, and `pt_BR.md`.
- Detects listing folders inside project roots, `store-listing` folders, and direct listing folders.
- Keeps multiple extension projects separate.
- Stores detailed description text, graphic asset metadata, category decisions, additional product fields, privacy-form text, data usage disclosure choices, preferences, and folder handles locally.
- Lets the user select an active project from options, popup, project rows, or the dashboard panel.
- Fills matching Chrome Web Store dashboard description fields with progress, abort, retry, and named failure reporting.
- Can expose an advanced Fill current language action for debugging or one-off manual fills.
- Selects the Chrome Web Store category from a detected project category document.
- Fills Chrome Web Store Additional fields values such as Homepage URL, Support URL, Official URL, and Mature content from a detected project document.
- Uploads discovered graphic assets for screenshots, icon, small promo, and marquee promo where the dashboard allows it.
- Fills Chrome Web Store privacy-form text from a detected project privacy document.
- Fills Chrome Web Store Data usage disclosure checkboxes from explicit yes values in a detected privacy document.

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
artifacts/storepilot-1.3.0.1.zip
```

AMO source-code upload package:

```powershell
.\scripts\build-amo-source.ps1
```

This creates:

```text
artifacts/source/storepilot-source-1.3.0.1.zip
```

Run release-facing checks:

```powershell
.\scripts\test-unit.ps1
.\scripts\test-modularization.ps1
.\scripts\test-reference-sync.ps1
.\scripts\test-amo-submission.ps1
.\scripts\test-firefox-release.ps1
```

After building `dist`, run the Firefox temporary-load check:

```powershell
.\scripts\test-firefox-temporary-load.ps1
```

This runs `web-ext lint` against `dist` and temporarily loads the add-on into Firefox through an isolated temporary profile. Node.js/npm are required only for test scripts that run JavaScript or `web-ext`; building the submitted extension package does not require Node.js.

## Current Workflow

1. Build and load StorePilot.
2. Open StorePilot options.
3. Import an extension project root, a `store-listing` folder, or a direct listing folder.
4. Select the active project.
5. Open the Chrome Web Store Developer Dashboard.
6. Use the dashboard panel or popup to fill listing fields, select category, fill additional fields, upload media, clear media, fill privacy fields, or fill Data usage disclosures.

StorePilot never clicks final submit, publish, or review actions automatically.

To remove StorePilot's local project data before uninstalling, open **Options > Preferences > Reset local data**.

## Project File Reference

For an extension with only one Chrome Web Store language today, start with one locale file and keep the structure ready for more languages:

```text
my-extension/
store-listing/
  chrome-web-store/
    listing/
      en.md
      # Add de.md, fr.md, pt_BR.md, etc. later.
    media/
      icon-128.png
      screenshots/
        01-main.png
        02-settings.png
      promo/
        small-promo.png
        marquee-promo.png
docs/
  chrome-web-store-additional-fields.md
  chrome-web-store-category.md
  chrome-web-store-privacy-form.md
```

`store-listing/chrome-web-store/listing/en.md` is copied directly into the Chrome Web Store **Detailed description** field. Do not include field labels such as `Name`, `Summary`, `Description`, or `Detailed Description`; do not include Markdown headings; and do not put the short summary in this file. It should contain only the final detailed description body users should see in the store listing.

Example `en.md` content:

```text
New Tab: Custom URL lets you choose what opens when you create a new tab.

Use a website, local HTML file, browser page, or a quiet blank page.
```

Alternative single-draft import: StorePilot also accepts `docs/chrome-web-store.md` for a single English draft. Only in this draft file, StorePilot may look for a `Detailed Description` or `Description` section and import that section as English detailed description text. This section parsing does not apply to `store-listing/chrome-web-store/listing/en.md`.

Fields not imported from `listing/en.md`: name, summary, category, homepage URL, support URL, official URL, mature content, and privacy fields. These belong in the Chrome Web Store dashboard or in dedicated automation documents, not in locale listing files.

Graphic assets should use `.png`, `.jpg`, or `.jpeg`: icon `128 x 128`, screenshots `1280 x 800` or `640 x 400` up to five files, small promo `440 x 280`, and marquee promo `1400 x 560`.

Category automation uses `docs/chrome-web-store-category.md` with an explicit selected category line:

```text
Selected category: Functionality and UI
```

Additional fields automation uses `docs/chrome-web-store-additional-fields.md`:

```text
[additional_fields]
official_url:
none

homepage_url:
https://example.com

support_url:
https://example.com/support

mature_content:
no
```

Omit a key or leave it blank when StorePilot should not touch that dashboard field. Use `none` for URL fields only when you want StorePilot to clear/select no URL. For `mature_content`, `yes` turns the dashboard switch on and `no` turns it off; `none`, blank, or omitted means do not touch the switch.

Privacy automation uses `docs/chrome-web-store-privacy-form.md`. Data usage and certification checkboxes use canonical keys inside the same `[privacy]` block:

```text
[privacy]
remote_code:
no

data_usage.web_history:
no

data_usage.website_content:
no

certification.no_sell_or_transfer:
yes

certification.no_unrelated_use:
yes

certification.no_creditworthiness:
yes
```

For remote code, `remote_code` is the Chrome Web Store Yes/No radio answer. Use `no` when all code is packaged locally, and do not include `remote_code_justification` for that case. Use `yes` only when the extension uses remote code, and then put the required textarea text in `remote_code_justification`.

For Data usage checkboxes, answer the exact Chrome Web Store public disclosure question: what user data do you plan to collect from users now or in the future? Treat collect as data that leaves local-only browser/device processing and is received, uploaded, logged, reviewed, or otherwise made available to the developer, a product backend, analytics, support, or a third-party service. These keys are not permission justifications and are not a list of data the extension can access or store locally. Use `yes` only for those developer or third-party collection cases. For local-only features where data stays on the user's device, use `no`; for example, a local history vault can need `permission.history` while still using `data_usage.web_history: no`. StorePilot applies explicit `yes`/`no` values: `yes` checks a box, `no` unchecks it; `none`, blank, or omitted leaves it unchanged.

## More Docs

- [docs/reference.md](docs/reference.md): pasteable StorePilot project-reference contract matching the options Reference tab.
- [docs/firefox-modularization-audit.md](docs/firefox-modularization-audit.md): current Firefox modularization gate result and named architecture follow-ups.
- [docs/storage-ownership.md](docs/storage-ownership.md): storage keys, owners, migration notes, retention, quota risk, and privacy classification.
- [docs/release-hygiene.md](docs/release-hygiene.md): GitHub release, artifact, license, and generated-file cleanliness rules.
- [PROJECT_SCOPE_AND_PHILOSOPHY.md](PROJECT_SCOPE_AND_PHILOSOPHY.md): product boundaries, design intent, and safety principles.
- [SPECIFICATIONS.md](SPECIFICATIONS.md): implementation details, data model, build flow, dashboard automation, and future-Codex context.
- [CHANGELOG.md](CHANGELOG.md): release history.
- [ROADMAP.md](ROADMAP.md): future automation ideas and prioritization notes.
- [AMO_SUBMISSION.md](AMO_SUBMISSION.md): Firefox Add-ons submission fields, reviewer notes, and validation gotchas.
- [store-listing/amo](store-listing/amo): AMO listing copy, screenshot order, and captions.

## Privacy

StorePilot does not collect or transmit data off your device. It has no analytics, no tracking, and no remote server; imported listings are stored only in local browser extension storage.

Use **Options > Preferences > Reset local data** to delete imported projects, preferences, dashboard bindings, folder permissions, and media file handles from this browser.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Support

If this extension saves you time and you want to support its development:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=000)](https://buymeacoffee.com/molodchyk)
[![Patreon](https://img.shields.io/badge/Patreon-support-F96854?logo=patreon&logoColor=fff)](https://www.patreon.com/OMolodchyk)

## License

This project is licensed under the GNU General Public License v3.0 or later. See [LICENSE](LICENSE) for details.

Source code:

```text
https://github.com/molodchyk/StorePilot
```
