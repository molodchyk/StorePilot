# StorePilot Specifications

## Repository Layout

- `manifest.json`: extension manifest and only manifest source.
- `scripts/build.ps1`: builds `dist` and `artifacts/storepilot-1.1.0.zip`.
- `scripts/build-amo-source.ps1`: builds `artifacts/source/storepilot-source-1.1.0.zip` for AMO source-code upload.
- `src/background.js`: action click behavior and options-page opening.
- `src/import-ui.js`: folder-import UI guidance and options-page import helpers.
- `src/project-overrides.js`: project identity canonicalization and duplicate import merging.
- `src/icons/*`: extension icons referenced by the manifest.
- `src/options/*`: options page UI, import controls, project list, media preview, privacy document preview, listing preview.
- `src/popup/*`: popup UI, project picker, dashboard commands, panel reopen control.
- `src/content/dashboard-helper.js`: content script for dashboard detection, fill automation, media automation, privacy automation, and the dashboard panel.
- `src/content/media-upload-main-world.js`: page-world bridge for dashboard media upload.
- `src/shared/constants.js`: storage keys, file extension allow/block lists, skipped directories.
- `src/shared/files.js`: locale filename and file/path helpers.
- `src/shared/directory-detection.js`: listing-folder detection and scoring.
- `src/shared/importers.js`: project/listing import flows.
- `src/shared/media-assets.js`: media asset discovery and scoring.
- `src/shared/privacy-doc.js`: privacy document discovery and parsing.
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
3. Creates `artifacts/storepilot-1.1.0.zip` with forward-slash archive entry names for AMO validation.
4. Replaces `dist`.

The packaging step intentionally uses `System.IO.Compression.ZipArchive` instead of PowerShell `Compress-Archive`, because AMO rejects Windows-style backslashes in zip entry names. It also computes staged-relative paths with a substring rather than `System.IO.Path.GetRelativePath` so the build works on older Windows PowerShell/.NET hosts.

## AMO Source Package

Run:

```powershell
.\scripts\build-amo-source.ps1
```

The script uses `git ls-files` and writes `artifacts/source/storepilot-source-1.1.0.zip`. This source zip is intended for AMO's source-code upload step when the submission form asks whether any tool copies/processes/generates files included in the extension.

The source package intentionally excludes ignored/generated output such as `dist/`, `dist-next/`, `artifacts/`, `.git/`, and local dependencies.

AMO submission field notes, reviewer notes, privacy text, and validation lessons are tracked in `AMO_SUBMISSION.md`.

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
- direct listing files

Import detection:

- Walks folders.
- Finds locale-named text files.
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

## Options Page

The options page is the main project management surface.

Structure:

1. Header and theme controls.
2. Active project dropdown/actions.
3. Import project/folder controls.
4. Privacy document reference.
5. Clickable Projects list.
6. Store media asset preview.
7. Privacy document preview.
8. Imported Listings preview.

The Projects list should stay above Imported Listings because it is navigation context. Rows are buttons with `data-project-id`; clicking one updates the active project and rerenders listings.

## Popup

The popup provides compact dashboard controls:

- project picker
- import/options access
- dashboard panel open control when the panel is hidden
- listing fill actions on listing pages
- media upload/clear actions on listing pages
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
- minimize/maximize control
- close control
- Options

Resilience rules:

- Theme changes rerender the panel.
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

## Media Automation

StorePilot detects store media assets during project import/re-import:

- store icon: 128 x 128
- screenshots: 1280 x 800 or 640 x 400, ordered by filename
- small promo tile: 440 x 280
- marquee promo tile: 1400 x 560

Rules:

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

The scanner accepts `.md`, `.markdown`, `.txt`, and `.text` files when the filename/content strongly suggest privacy-form use. A `[privacy]` block and canonical keys give the strongest content signal.

Canonical keys:

- `single_purpose`
- `privacy_policy_url`
- `host_permission`
- `remote_code`
- `permission.<manifest permission code>`

Examples:

```text
[privacy]
single_purpose:
...

permission.storage:
...

permission.activeTab:
...
```

Field matching rules:

- If the dashboard field exposes `data-payload`, that payload is authoritative.
- Permission fields match `permission.<code>` to `data-payload="<code>"`.
- `remote_code` can be skipped successfully when the dashboard has "No remote code" selected and its justification field is disabled.
- Heuristic label/context matching is only a fallback when no authoritative payload is available.

## Icons

Icon assets live in `src/icons`:

- `icon16.png`
- `icon32.png`
- `icon48.png`
- `icon96.png`
- `icon128.png`

The manifest references these under both `icons` and `action.default_icon`.

## Verification Checklist

After changes, run the narrow checks that match the touched files:

```powershell
node --check src\background.js
node --check src\import-ui.js
node --check src\project-overrides.js
node --check src\content\dashboard-helper.js
node --check src\content\media-upload-main-world.js
node --check src\popup\popup.js
node --check src\options\options.js
node --check src\shared\media-assets.js
node --check src\shared\privacy-doc.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8')); console.log('manifest ok')"
```

Then rebuild:

```powershell
.\scripts\build.ps1
```

Check the generated package:

```powershell
node --check dist\src\content\dashboard-helper.js
node --check dist\src\popup\popup.js
node --check dist\src\options\options.js
node -e "JSON.parse(require('fs').readFileSync('dist/manifest.json','utf8')); console.log('dist manifest ok')"
```

## Future Work

- Store-specific adapters for AMO and Edge Add-ons.
- Package zip upload workflows.
- Store API integration where safer than UI automation.
- Release checklist generation.
- Better dashboard DOM diagnostics when Google changes the UI.
- Tests around project identity merging, fill-all state transitions, media operations, and privacy field routing.
