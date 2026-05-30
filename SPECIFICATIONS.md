# StorePilot Specifications

## Repository Layout

- `manifest.json`: Chrome development manifest.
- `manifest.firefox.json`: Firefox manifest source.
- `scripts/build-firefox.ps1`: builds `dist-firefox` and `artifacts/firefox/storepilot-firefox-1.0.0.zip`.
- `src/options/*`: options page UI, import controls, project list, listing preview.
- `src/popup/*`: popup UI, project/locale picker, dashboard commands.
- `src/content/dashboard-helper.js`: content script for dashboard detection/fill automation and mini panel.
- `src/shared/constants.js`: storage keys, file extension allow/block lists, skipped directories.
- `src/shared/files.js`: locale filename and file/path helpers.
- `src/shared/directory-detection.js`: listing-folder detection and scoring.
- `src/shared/importers.js`: project/listing import flows.
- `src/shared/projects.js`: project creation, naming, identity helpers.
- `src/shared/storage.js`: project storage in extension storage.
- `src/shared/handles.js`: IndexedDB folder-handle storage.
- `src/shared/sync.js`: sync active/all projects from saved handles.
- `src-firefox/*`: Firefox-only overrides, background script, import UI patch, project identity override, icons.

## Firefox Build Flow

Run:

```powershell
.\scripts\build-firefox.ps1
```

The script:

1. Creates `dist-firefox-next`.
2. Copies `src` into `dist-firefox-next/src`.
3. Copies `manifest.firefox.json` to `dist-firefox-next/manifest.json`.
4. Runs `src-firefox/apply-firefox-overrides.ps1`.
5. Creates `artifacts/firefox/storepilot-firefox-1.0.0.zip`.
6. Replaces `dist-firefox` if Firefox is not locking the folder.

Important: `apply-firefox-overrides.ps1` rewrites parts of `src/content/dashboard-helper.js`, especially mini panel rendering/styling. If Firefox behavior differs from source behavior, inspect both:

- `src/content/dashboard-helper.js`
- `src-firefox/apply-firefox-overrides.ps1`
- generated `dist-firefox/src/content/dashboard-helper.js`

## Browser Constraints

Chrome cannot automate Chrome Web Store dashboard pages from a Chrome extension. Chrome blocks content-script injection on Chrome extension gallery pages and returns errors like:

```text
The extensions gallery cannot be scripted.
```

Therefore:

- Chrome can manage imports/projects/local text.
- Chrome can copy text for manual paste.
- Chrome cannot run StorePilot dashboard fill actions on Chrome Web Store pages.
- Firefox can run StorePilot against Chrome Web Store pages because Chrome's extension-gallery content-script restriction does not apply to Firefox.

Do not remove this distinction unless the browser platform behavior changes.

## Data Model

A StorePilot project represents one browser extension being published.

Project fields currently include:

- `id`: generated UUID-like project ID.
- `name`: display name.
- `listings`: locale-to-text map.
- `sourcePath`: canonical project source path shown to the user.
- `projectRootPath`: Firefox canonical root when known.
- `listingPath`: detected folder that contains locale listing files.
- `listingSignature`: stable signature of imported locale text, used to merge duplicates.
- `confidence`: detection confidence.
- `score`: detection score.
- `candidateCount`: count of detected candidate listing folders.
- `lastSyncedAt`: ISO timestamp.
- `hasFolderHandle`: whether sync can use a saved folder handle.

Storage:

- Projects live in `chrome.storage.local` / `browser.storage.local`.
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

Shared import detection:

- Walks folders.
- Finds locale-named text files.
- Scores candidate directories using locale count, listing-like text, English presence, known folder names, and skipped folders.

Firefox identity override:

- `src-firefox/firefox-project-overrides.js` replaces import functions in Firefox.
- It tries to infer a canonical project root from known paths.
- If the first import only exposes a generic folder like `listing`, later imports with a better root upgrade the existing project.
- It uses `listingSignature` to merge duplicate projects when path identity is incomplete.
- It removes duplicate sibling records when a better canonical project is discovered.

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
4. Clickable Projects list.
5. Imported Listings preview.

The Projects list should stay above Imported Listings because it is navigation context. Rows are buttons with `data-project-id`; clicking one updates the active project and rerenders listings.

## Popup

The popup provides compact dashboard controls:

- project picker
- locale picker where applicable
- import/options access
- fill current language
- fill all languages
- abort fill all
- theme controls

Popup state considerations:

- The popup can close while a dashboard fill-all process continues in the content script.
- When reopened, it must ask the active dashboard for `storepilot-get-fill-all-status`.
- While it believes fill-all is running, it polls live dashboard state every 500 ms.
- It also listens for `storepilot-fill-all-progress` runtime messages and storage changes.
- Abort visibility must come from live fill-all state, not from a stale local popup boolean.

## Mini Panel

The mini panel is rendered by `src/content/dashboard-helper.js` on supported dashboard pages.

It includes:

- StorePilot title
- active project/locales metadata
- last updated or fill progress status
- Fill current
- Fill all
- Abort during fill-all
- Options

Resilience rules:

- Theme changes rerender the panel.
- Fill-all completion must update the currently rendered panel, not only the old button instances captured by a closure.
- Buttons use `data-storepilot-action` markers.
- `updatePanelFillAllUi()` must hide/show current Abort buttons and enable/disable current Fill buttons from live state.
- Firefox build overrides must preserve these markers.

## Fill-All State Machine

Fill-all lives in the dashboard content script, not the popup.

State:

- `isFillingAllLanguages`
- `fillAllAbortRequested`
- `fillAllStatus`
- persisted `storePilotFillAllStatus`

Messages:

- `storepilot-fill-all-languages`: starts fill-all from popup.
- `storepilot-abort-fill-all`: requests stop.
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
- special handling for `English (Standard)` as `en`

Known useful mappings:

- `English (Standard)` -> `en`
- `Arabic` -> `ar`
- `Romanian - ro (ro)` or similar -> `ro`

The fill-all loop:

1. Opens the language dropdown.
2. Reads available options.
3. Matches options to imported locales.
4. Fills each matching option.
5. Retries failed options once.
6. Reports exact remaining failures by dashboard label and locale.

## Icons

Firefox icon assets live in `src-firefox/icons`:

- `icon16.png`
- `icon32.png`
- `icon48.png`
- `icon96.png`
- `icon128.png`

The Firefox manifest references these under both `icons` and `action.default_icon`.

## Verification Checklist

After changes, run the narrow checks that match the touched files:

```powershell
node --check src\content\dashboard-helper.js
node --check src\popup\popup.js
node --check src\options\options.js
node --check dist-firefox\src\content\dashboard-helper.js
node --check dist-firefox\src\popup\popup.js
node --check dist-firefox\src\options\options.js
node -e "JSON.parse(require('fs').readFileSync('manifest.firefox.json','utf8')); JSON.parse(require('fs').readFileSync('dist-firefox/manifest.json','utf8')); console.log('manifest ok')"
```

After Firefox-relevant changes, rebuild:

```powershell
.\scripts\build-firefox.ps1
```

## Future Work

- Store-specific adapters for Firefox AMO and Edge Add-ons.
- Media asset import and validation.
- Package zip upload workflows.
- Store API integration where safer than UI automation.
- Release checklist generation.
- Better dashboard DOM diagnostics when Google changes the UI.
- Tests around project identity merging and fill-all state transitions.
