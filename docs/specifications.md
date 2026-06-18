# StorePilot Specifications

## Repository Layout

- `manifest.json`: extension manifest and only manifest source.
- `scripts/build.ps1`: builds `dist` and `artifacts/storepilot-<manifest version>.zip`.
- `scripts/build-amo-source.ps1`: builds `artifacts/source/storepilot-source-<manifest version>.zip` for AMO source-code upload.
- `src/background.js`: thin background message/action entry.
- `src/background/media.js`: background media file-handle resolution and dashboard upload delegation.
- `src/import-ui.js`: folder-import UI guidance and options-page import helpers.
- `src/project-overrides.js`: project identity canonicalization and duplicate import merging.
- `assets/icons/*`: extension icons referenced by the manifest.
- `src/options/*`: options page UI, import controls, project list, media preview, privacy document preview, settings, and listing preview.
- `src/popup/*`: popup UI, project picker, dashboard commands, panel reopen control.
- `src/content/dashboard-helper.js`: content-script message routing, diagnostics, and dashboard panel startup.
- `src/content/dashboard-project-context.js`: dashboard extension-id, item-title, and project-binding resolution.
- `src/content/media-upload-main-world.js`: page-world bridge for dashboard media upload.
- `src/shared/constants.js`: storage keys, file extension allow/block lists, skipped directories.
- `src/shared/files.js`: locale filename and file/path helpers.
- `src/shared/directory-detection.js`: listing-folder detection and scoring.
- `src/shared/importers.js`: project/listing import flows.
- `src/shared/media-assets.js`: media asset discovery and scoring.
- `src/shared/store-docs/privacy-doc.js`: privacy document discovery and parsing.
- `src/shared/store-docs/category-doc.js`: Chrome Web Store category document discovery and parsing.
- `src/shared/store-docs/additional-fields-doc.js`: Chrome Web Store Additional fields document discovery and parsing.
- `src/shared/projects.js`: project creation, naming, identity helpers.
- `src/shared/storage.js`: project storage in extension storage.
- `src/shared/handles.js`: IndexedDB folder-handle storage.

## Build Flow

Run:

```powershell
.\scripts\build.ps1
```

The script:

1. Creates `dist-next`.
2. Copies `src`, `_locales`, and `manifest.json` into `dist-next`.
3. Creates `artifacts/storepilot-<manifest version>.zip` with forward-slash archive entry names for AMO validation.
4. Replaces `dist`.

The packaging step intentionally uses `System.IO.Compression.ZipArchive` instead of PowerShell `Compress-Archive`, because AMO rejects Windows-style backslashes in zip entry names. It also computes staged-relative paths with a substring rather than `System.IO.Path.GetRelativePath` so the build works on older Windows PowerShell/.NET hosts.

## AMO Source Package

Run:

```powershell
.\scripts\build-amo-source.ps1
```

The script uses tracked `git ls-files` paths and writes `artifacts/source/storepilot-source-<manifest version>.zip`. This source zip is intended for AMO's source-code upload step when the submission form asks whether any tool copies/processes/generates files included in the extension.

The source package intentionally excludes ignored/generated output such as `dist/`, `dist-next/`, `artifacts/`, `.git/`, and local dependencies.

AMO submission field notes, reviewer notes, privacy text, and validation lessons are tracked in `docs/amo-submission.md`.

## Data Model

A StorePilot project represents one browser extension being published.

Project fields currently include:

- `id`: generated UUID-like project ID.
- `name`: display name.
- `listings`: locale-to-text map.
- `sourcePath`: canonical project source path shown to the user.
- `projectRootPath`: canonical root when known.
- `listingPath`: detected folder that contains locale listing files.
- `listingSignature`: stable signature of imported locale text, used to merge duplicates.
- `mediaAssets`: detected store icon, screenshots, small promo, and marquee promo.
- `privacyDoc`: detected privacy document summary and parsed fields.
- `categoryDoc`: detected Chrome Web Store category decision summary.
- `additionalFieldsDoc`: detected Chrome Web Store Additional fields summary and parsed values.
- `confidence`: detection confidence.
- `score`: detection score.
- `candidateCount`: count of detected candidate listing folders.
- `lastSyncedAt`: ISO timestamp.
- `hasFolderHandle`: whether StorePilot has a saved local folder handle for resolving media files.

Storage:

- Projects live in `browser.storage.local`.
- Folder handles live in IndexedDB, keyed by project ID.
- Fill-all live state uses `storePilotFillAllStatus` in extension storage.

## Project Identity And Import Rules

The extension must avoid creating separate projects for nested folders of the same extension.

Valid user selections include:

- extension root, for example `YoutubeMixBlocker`
- `store-listing`
- `store-listing/chrome-web-store`
- `store-listing/chrome-web-store/listing`
- a one-language project with a single store draft, for example `docs/chrome-web-store.md`
- direct listing files

Import detection:

- Walks folders.
- Finds locale-named text files.
- Treats a Chrome Web Store draft document as the English Detailed description source when the project only has one listing language.
- Scores candidate directories using locale count, listing-like text, English presence, known folder names, and skipped folders.
- Carries project-root evidence from ancestor directories into listing-folder candidates. Evidence includes common root markers such as `.git`, `README`, extension manifests, package/build config files, `src`, `_locales`, `store-listing`, privacy/license/release notes, and assets folders.
- Uses `listingSignature` to merge duplicate projects when path identity is incomplete.
- Upgrades a generic first import, such as `listing`, when a later import exposes a better project root.

When changing import behavior, test these scenarios:

- root then listing subfolder
- listing subfolder then root
- `store-listing` then root
- duplicate existing project with same listings
- project names that contain spaces, hyphens, or underscores

## Recommended Project Import Reference

The reference shown in the options page should be useful for a project that has only one Chrome Web Store language today and may add more languages later. The recommended future-friendly shape is:

```text
my-extension/
manifest.json
src/
_locales/
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

Detailed description text rules:

- A direct locale file such as `en.md`, `en.txt`, `en_US.md`, `de.md`, or `pt_BR.md` is copied directly into that locale's Chrome Web Store Detailed description field.
- For a one-language project, `store-listing/chrome-web-store/listing/en.md` is preferred because sibling locale files can be added later.
- Direct locale files must contain only the final detailed description body users should see in the store listing.
- Direct locale files must not include field labels such as `Name`, `Summary`, `Description`, or `Detailed Description`.
- Direct locale files must not include Markdown headings or the short summary.

Example `en.md` content:

```text
New Tab: Custom URL lets you choose what opens when you create a new tab.

Use a website, local HTML file, browser page, or a quiet blank page.
```

- StorePilot also accepts a focused draft such as `docs/chrome-web-store.md`; only this draft flow may parse the `Detailed Description`, `Store Description`, or `Description` section and import that section as English detailed description text.
- Section parsing does not apply to direct locale files such as `store-listing/chrome-web-store/listing/en.md`.
- Fields not imported from `listing/en.md`: name, summary, category, homepage URL, support URL, official URL, mature content, and privacy fields.
- Those fields belong in the Chrome Web Store dashboard or in dedicated automation documents, not in locale listing files.
- Supported listing-like text extensions are defined in `STOREPILOT_TEXT_LISTING_EXTENSIONS`.

Media rules:

- Accepted media extensions are `.png`, `.jpg`, and `.jpeg`.
- Store icon: 128 x 128.
- Screenshots: 1280 x 800 or 640 x 400, maximum five, ordered by filename.
- Small promo tile: 440 x 280.
- Marquee promo tile: 1400 x 560.
- Helpful folder/file names include `media`, `screenshots`, `promo`, `assets`, `store-assets`, `icons`, `icon`, `logo`, `small`, `tile`, `marquee`, `large`, and `banner`.

Privacy rules:

- Preferred filename: `docs/chrome-web-store-privacy-form.md`.
- Also accepted: `STORE_JUSTIFICATIONS.md` or other `.md`, `.markdown`, `.txt`, and `.text` files when filename/content strongly indicate Chrome Web Store privacy-form use.
- A `[privacy]` block with canonical keys gives the strongest content signal.

Category rules:

- Preferred filename: `docs/chrome-web-store-category.md`.
- The file must contain an explicit `Selected category: <visible Chrome Web Store category>` line.
- StorePilot stores the selected category label and CWS `data-value` code during import.
- The listing-page popup and panel expose `Select category`, which opens the CWS category dropdown and clicks the matching option.
- Supported visible labels are Communication, Developer Tools, Education, Tools, Workflow and planning, Art & Design, Entertainment, Games, Household, Just for fun, News & Weather, Shopping, Social Networking, Travel, Wellbeing, Accessibility, Functionality and UI, and Privacy & Security.

Additional fields rules:

- Preferred filename: `docs/chrome-web-store-additional-fields.md`.
- Also accepted: other `.md`, `.markdown`, `.txt`, and `.text` files when filename/content strongly indicate Chrome Web Store Additional fields use.
- A `[additional_fields]` block with canonical keys gives the strongest content signal.
- Canonical keys are `official_url`, `homepage_url`, `support_url`, and `mature_content`.
- Omitted keys and blank values mean StorePilot should not touch that dashboard field.
- For URL fields, `none` means explicitly clear the text field or select the `None` dropdown option where the dashboard supports it.
- For `mature_content`, `yes`, `true`, `on`, or `1` means turn the switch on; `no`, `false`, `off`, or `0` means turn it off; `none`, blank, or omitted means do not touch the switch.
- Official URL is a verified-site dropdown in the Chrome Web Store dashboard. StorePilot can select `None` or an already-visible matching option, but it does not register new sites or click `Add a new site`.

## Options Page

The options page is the main project management surface.

Structure:

1. Header and theme controls.
2. Active project dropdown/actions.
3. Import project/folder controls.
4. Preferences, including the hidden-by-default advanced fill actions toggle.
5. Product Details preview, including imported description locales and detected category.
6. Graphic asset preview.
7. Additional Fields preview.
8. Privacy document preview.
9. Clickable Projects list.
10. Project import reference, including one-language layout, listing files, graphic assets, category file, additional fields file, and privacy document keys.

Project rows are buttons with `data-project-id`; clicking one updates the active project and rerenders listings.

## Popup

The popup provides compact dashboard controls:

- project picker
- import/options access
- dashboard panel open control when the panel is hidden
- description fill and category selection actions on listing pages
- media upload/clear actions on listing pages
- additional fields fill action on listing pages below graphic asset actions
- privacy fill actions on privacy pages
- general abort for running operations
- theme controls

Popup state considerations:

- The popup can close while a dashboard fill-all or media operation continues in the content script.
- When reopened, it must ask the active dashboard for live status.
- Abort visibility must come from live operation state, not from a stale local popup boolean.

## Dashboard Panel

The dashboard panel is rendered by `src/content/dashboard-helper.js` on supported dashboard pages.

It includes:

- StorePilot title
- active project metadata
- last updated or live progress status
- listing, media, or privacy actions depending on the dashboard section
- Additional fields action on listing pages after graphic asset actions
- minimize/maximize control
- close control
- Options

Resilience rules:

- Theme changes rerender the panel.
- The advanced Fill current language action is hidden by default and rendered only when `storePilotSettings.showAdvancedFillActions` is true.
- Panel position clamps to the current viewport after resize and visual viewport changes.
- Panel visibility/mode is stored in page `localStorage`.
- Buttons use `data-storepilot-action` markers.
- Long-running operations must update the currently rendered panel, not only the old button instances captured by a closure.

## Fill-All State Machine

Fill-all lives in the dashboard content script, not the popup.

State:

- `isFillingAllLanguages`
- `fillAllAbortRequested`
- `fillAllStatus`
- persisted `storePilotFillAllStatus`

Messages:

- `storepilot-fill-all-languages`: starts fill-all from popup.
- `storepilot-abort-operation`: requests stop for fill-all or media.
- `storepilot-get-fill-all-status`: returns live status for popup reattachment.
- `storepilot-fill-all-progress`: best-effort progress push to popup.

Progress wording:

- Running: `Filling 12/50: Arabic (ar)...`
- Retry: `Retrying 1/2: English (Standard) (en)...`
- Success after retry: `Filled 50 dashboard languages. Recovered 1 after retry.`
- Unrecovered failures: `Filled 48 dashboard languages; failed 2: English (Standard) (en), Arabic (ar). Retried 2; none recovered.`
- User stop: `Stopped. Filled 0 dashboard languages.`

Abort is not an error. Do not show diagnostics for normal aborts.

## Dashboard Language Matching

The Chrome Web Store dashboard may show language labels rather than locale codes.

Matching therefore uses:

- exact locale code matching, normalized with `_`/`-`
- `Intl.DisplayNames` labels
- old/new locale aliases such as `he/iw`, `id/in`, and `no/nb`
- special handling for `English (Standard)` as `en`

The fill-all loop:

1. Opens the language dropdown.
2. Reads available options.
3. Matches options to imported locales.
4. Fills each matching option.
5. Retries failed options once.
6. Reports exact remaining failures by dashboard label and locale.

Known Chrome Web Store language picker modes:

- Multi-locale / localized listing mode: the active editing language picker appears near the top of the Store listing page, under the Store listing heading, as "Current editing language" with a required `Language` combobox. The visible value can look like `English – en (default)`.
- One-language / no-internationalization mode: Chrome Web Store can instead show the language picker inside Product details, below the Description and Category fields and immediately above the Graphic assets section. The left Product details header still shows the current language, such as `English – en`, but the editable `Language*` combobox is lower on the page and may initially show `Select a language`.
- Do not conflate these modes. A selector that finds the top "Current editing language" picker in multi-locale mode may miss the lower Product details language picker in one-language mode. Conversely, a selector that assumes the lower Product details picker exists can choose the wrong control on localized listings.
- The one-language picker observed in Chrome Web Store is a Material combobox with `role="combobox"`, `aria-required="true"`, `aria-labelledby` pointing at a label whose text is `Language`, and an associated `role="listbox"` whose options have locale `data-value` values such as `en`, `en_US`, `de`, `pt_BR`, etc. It appeared around `section[1]/div[2]/div[4]` in the listing article (`div.TVM7Wc:nth-child(5) ...`) and below the Category field. Treat these paths as diagnostic context only; prefer semantic detection from the label text, combobox/listbox roles, option locale values, and nearby Product details / Graphic assets section boundaries.
- When only one locale was imported, StorePilot should still know the imported locale from the project listing key and must select the matching one-language Product details language option before or while filling the description. It should not assume the visible Product details language label is enough if the lower `Language*` combobox still says `Select a language`.

## Media Automation

StorePilot detects Chrome Web Store graphic assets during project import/re-import:

- store icon: 128 x 128
- screenshots: 1280 x 800 or 640 x 400, ordered by filename
- small promo tile: 440 x 280
- marquee promo tile: 1400 x 560

Rules:

- Accepted image extensions are `.png`, `.jpg`, and `.jpeg`.
- Never upload more than five screenshots.
- Do not attempt a second upload for single-slot media when the dashboard already has or is processing that media.
- Clear actions are disabled when no matching media is visible.
- Upload and clear actions are mutually exclusive with fill-all and each other.
- Abort requests should stop after the current in-flight dashboard step.

## Privacy Automation

StorePilot scans project documents for a Chrome Web Store privacy form document. Recommended filename:

```text
docs/chrome-web-store-privacy-form.md
```

The scanner also recognizes `STORE_JUSTIFICATIONS.md` and accepts `.md`, `.markdown`, `.txt`, and `.text` files when the filename/content strongly suggest privacy-form use. A `[privacy]` block and canonical keys give the strongest content signal.

Canonical keys:

- `single_purpose`
- `privacy_policy_url`
- `host_permission`
- `remote_code`
- `remote_code_justification`
- `permission.<manifest permission code>`
- `data_usage.personally_identifiable_information`
- `data_usage.health_information`
- `data_usage.financial_payment_information`
- `data_usage.authentication_information`
- `data_usage.personal_communications`
- `data_usage.location`
- `data_usage.web_history`
- `data_usage.user_activity`
- `data_usage.website_content`
- `certification.no_sell_or_transfer`
- `certification.no_unrelated_use`
- `certification.no_creditworthiness`

Examples:

```text
[privacy]
single_purpose:
...

permission.storage:
...

permission.activeTab:
...

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

Field matching rules:

- If the dashboard field exposes `data-payload`, that payload is authoritative.
- Permission fields match `permission.<code>` to `data-payload="<code>"`.
- `remote_code` controls the Chrome Web Store remote-code Yes/No radio. `no` selects "No, I am not using remote code"; do not include `remote_code_justification` for that case.
- `remote_code_justification` is required only when `remote_code` resolves to `yes`; legacy prose in `remote_code` is treated as a Yes justification unless it clearly says remote code is not used.
- Data usage disclosure checkboxes are filled by a dedicated explicit action, not by the generic privacy fill action.
- Data usage values answer the exact Chrome Web Store public disclosure question: what user data do you plan to collect from users now or in the future? Treat collect as data that leaves local-only browser/device processing and is received, uploaded, logged, reviewed, or otherwise made available to the developer, a product backend, analytics, support, or a third-party service.
- Data usage values are not inferred from manifest permissions and are not a list of data the extension can access or store locally. For local-only features where data stays on the user's device, use `no`; for example, `permission.history` can need a permission justification while a local history vault still uses `data_usage.web_history: no`.
- Data usage categories and certification boxes are mapped by the Chrome Web Store section structure and top-to-bottom order so the action is not dependent on English dashboard labels.
- Explicit `yes` values check Data usage boxes, and explicit `no` values uncheck them. `none`, blank, or omitted values leave boxes untouched.
- The Data Usage options tab shows the imported Data usage and certification values separately from text privacy fields.
- Heuristic label/context matching is only a fallback when no authoritative payload is available.

## Additional Fields Automation

StorePilot scans project documents for a Chrome Web Store Additional fields document. Recommended filename:

```text
docs/chrome-web-store-additional-fields.md
```

Example:

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

Dashboard behavior:

- `official_url`: opens the Official URL dropdown and selects `None` or an already-visible matching verified-site option.
- `homepage_url`: fills or clears the Homepage URL text input.
- `support_url`: fills or clears the Support URL text input.
- `mature_content`: sets the Mature content switch when the value is explicitly yes/no.

Safety behavior:

- StorePilot does not click `Add a new site` or attempt Google Search Console ownership setup.
- Blank URL values and omitted URL keys are skipped.
- `none` for URL values is an explicit clear/select-none instruction.
- `none`, blank, or omitted `mature_content` is skipped.

## Icons

Icon assets live in `assets/icons`:

- `icon16.png`
- `icon32.png`
- `icon48.png`
- `icon96.png`
- `icon128.png`

The manifest references these under both `icons` and `action.default_icon`.

## Verification Checklist

After changes, run the narrow checks that match the touched files:

```powershell
.\scripts\test-amo-submission.ps1
.\scripts\test-reference-sync.ps1
node --check src\background.js
node --check src\background\media.js
node --check src\import-ui.js
node --check src\project-overrides.js
node --check src\content\dashboard-helper.js
node --check src\content\dashboard-project-context.js
node --check src\content\media-upload-main-world.js
node --check src\popup\popup.js
node --check src\options\options.js
node --check src\options\options-settings.js
node --check src\shared\media-assets.js
node --check src\shared\store-docs\privacy-doc.js
node --check src\shared\store-docs\category-doc.js
node --check src\shared\store-docs\additional-fields-doc.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

Then rebuild:

```powershell
.\scripts\build.ps1
```

Check the generated package:

```powershell
node --check dist\src\content\dashboard-helper.js
node --check dist\src\content\dashboard-project-context.js
node --check dist\src\background\media.js
node --check dist\src\popup\popup.js
node --check dist\src\options\options.js
node --check dist\src\options\options-settings.js
node -e "JSON.parse(require('fs').readFileSync('dist/manifest.json','utf8')); console.log('dist manifest ok')"
```

## Future Work

- See `docs/roadmap.md` for prioritized future automation notes.
- Store-specific adapters for AMO and Edge Add-ons.
- Package zip upload workflows.
- Store API integration where safer than UI automation.
- Release checklist generation.
- Better dashboard DOM diagnostics when Google changes the UI.
- Tests around project identity merging, fill-all state transitions, media operations, and privacy field routing.
