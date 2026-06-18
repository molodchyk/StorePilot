# Firefox Modularization Audit

Last reviewed: 2026-06-18.

Result: deferred with reason.

This audit satisfies the Firefox Extension Playbook architecture and modularization gate for the StorePilot 1.3.0.1 release-prep pass. StorePilot has useful shared modules and release scaffolding, but the current source tree is not yet compliant with the Firefox Extension Modularization Playbook's target architecture.

File size and flat folder density are active architecture constraints. New source files over the soft budget or tracked repository folders over the flat-file budget must be split or explicitly named in this audit with a reason. Generated output and one-file locale folders are not useful density signals and are excluded from the script.

## Reason For Deferral

StorePilot's largest remaining gaps are in high-risk runtime surfaces that automate live Chrome Web Store dashboard pages and render the main options UI. Splitting those files immediately before an AMO re-upload would mix broad structural movement with policy-sensitive dashboard behavior. That is the kind of refactor the modularization playbook says to migrate in small verified steps, not as a release-prep side effect.

## Source Tree Evidence

Runtime entry and surface files inspected:

| File | Current role | Audit result |
| --- | --- | --- |
| `src/background.js` | Background message handling, media upload orchestration, action-click behavior | Slightly over the entry-file budget and still owns browser API orchestration directly. |
| `src/content/dashboard-helper.js` | Dashboard detection, panel UI behavior, selector strategy, description fill, Additional fields, privacy, Data usage, and media upload coordination | Major architecture debt. This is the main content-script runtime and still owns multiple feature behaviors that should move into feature modules. First content split done: injected panel CSS moved out to `src/content/dashboard-panel-styles.js`. Second content split done: category and privacy disclosure constants now come from shared modules instead of being duplicated in this helper. Third content split done: dashboard project-resolution logic now delegates to the tested shared storage module. Fourth content split done: generic content DOM/form helpers moved to `src/content/dashboard-dom.js`. Fifth content split done: category dropdown detection and selection moved to `src/content/dashboard-category.js`. |
| `src/content/dashboard-dom.js` | Focused content-script DOM visibility, text, form-fill, and timing helpers loaded before the main content helper | Acceptable focused content utility module. Keep generic content DOM/form mechanics here instead of growing `src/content/dashboard-helper.js`. |
| `src/content/dashboard-category.js` | Focused Chrome Web Store category dropdown matching and selection behavior | Acceptable focused dashboard-fill content helper. Keep category selector changes here instead of growing `src/content/dashboard-helper.js`. |
| `src/content/dashboard-panel-styles.js` | Focused dashboard panel CSS injector loaded before the main content helper | Acceptable focused content UI helper. Keep panel styling changes here instead of growing `src/content/dashboard-helper.js`. |
| `src/content/media-upload-main-world.js` | Narrow page-world upload bridge | Acceptable as a focused page bridge. |
| `src/popup/popup.js` | Popup state, project selection, action handlers, and action availability | First split done. This file is now under the preferred UI-module budget after dashboard page detection, project-context resolution, active-tab messaging, panel state, and popup media dashboard state moved to `src/popup/dashboard-page.js`. |
| `src/popup/dashboard-page.js` | Popup-owned active-tab messaging, dashboard project binding resolution, panel visibility, and media action state | Acceptable focused popup helper. It now uses shared dashboard URL helpers instead of owning URL parsing directly. Keep this separate from content-script selector and fill logic. |
| `src/options/options.js` | Options-page state coordination, import flow, project cards, preferences, reset, and event wiring | First split done. This file is now under the preferred UI-module budget after media preview/rendering moved to `src/options/options-media.js` and privacy/category/additional/data-usage review tables moved to `src/options/options-review-tables.js`. |
| `src/options/options-media.js` | Options-page Graphic Assets preview overlay, media cards, media summaries, and media file handle previews | Acceptable focused options helper. |
| `src/options/options-review-tables.js` | Options-page Privacy Document, Data Usage, Additional Fields, Product Details category, and language-diagnostic review tables | Acceptable focused options helper. |
| `src/options/options.css` | Core options-page layout, controls, status cards, tabs, tables, and media cards | First split done. This file is now under the stylesheet budget after modal/reference, responsive, and theme rules moved to focused CSS files. |
| `src/options/options-reference.css` | Options-page media review modal and Reference tab styles | Acceptable focused stylesheet. |
| `src/options/options-responsive.css` | Options-page responsive layout rules | Acceptable focused stylesheet. |
| `src/options/options-theme.css` | Options-page system, dark, and light theme overrides | Acceptable focused stylesheet. |

Feature and shared modules already present:

- `src/shared/additional-fields-doc.js`
- `src/shared/category-doc.js`
- `src/shared/dashboard-url.js`
- `src/shared/directory-detection.js`
- `src/shared/importers.js`
- `src/shared/media-assets.js`
- `src/shared/privacy-doc.js`
- `src/shared/projects.js`
- `src/shared/storage.js`
- `src/content/dashboard-dom.js`
- `src/content/dashboard-category.js`
- `src/content/dashboard-panel-styles.js`
- `src/popup/dashboard-page.js`

These modules are useful migration footholds, but they are still broad shared modules rather than feature-owned `features/*/core`, `features/*/content`, `features/*/popup`, and `features/*/options` modules.

Browser/platform boundary inspected:

- StorePilot uses Firefox's `browser.*` API through the global `STOREPILOT_API`.
- `src/platform/webextension.js` now owns direct WebExtension API calls for storage, runtime, tabs, scripting, action, i18n, and extension URL helpers.
- Existing runtime files now use the platform wrapper for new WebExtension API access.
- The dashboard content script now loads shared category and privacy document modules before the main helper so imported metadata constants are not duplicated across options, popup, and content surfaces.
- Dashboard project binding and project-title resolution now reuse `src/shared/storage.js`, keeping the popup and content script on the same tested project-resolution behavior.
- Dashboard URL detection and extension-id extraction now live in `src/shared/dashboard-url.js`, keeping popup, content, and project-resolution tests on one dashboard URL contract.
- Future migration should split the single platform wrapper into narrower `src/platform/webextension/*` modules once the build/runtime loading shape supports that cleanly.

Storage and migration ownership inspected:

- Project state, active-project state, dashboard project bindings, imported listing data, handles, and media file references are visible in `src/shared/storage.js`, `src/shared/handles.js`, and `src/shared/constants.js`.
- Storage ownership is documented in `docs/storage-ownership.md` with owner, data shape, migration path, retention, quota risk, and privacy classification for each current key/store.

Test coverage inspected:

- `test/project-resolution.test.js` covers dashboard project-id resolution and binding selection.
- Release scripts validate manifest paths, locale shape, privacy/AMO text, packaging, zip paths, remote-code-like patterns, source upload contents, reference sync, and Firefox temporary load.
- There is not yet enough feature-owned coverage to safely split dashboard fill, media upload, privacy/Data usage fill, or options rendering in one broad refactor.

## Named Follow-Ups

1. `Split dashboard fill feature modules`
   - First content split done in this pass: dashboard panel CSS injection now lives in `src/content/dashboard-panel-styles.js`.
   - Second content split done in this pass: `src/content/dashboard-helper.js` reuses `src/shared/category-doc.js` and `src/shared/privacy-doc.js` constants for category options, Data Usage keys, and certification keys.
   - Third content split done in this pass: dashboard project binding and title matching now delegate to `src/shared/storage.js`, which is covered by `test/project-resolution.test.js`.
   - Fourth content split done in this pass: generic content DOM/form helpers now live in `src/content/dashboard-dom.js`.
   - Fifth content split done in this pass: category dropdown detection and selection now live in `src/content/dashboard-category.js`.
   - Remaining work: move description fill, Additional fields fill, privacy fill, Data Usage fill, selector diagnostics, and dashboard panel rendering behavior out of `src/content/dashboard-helper.js` into feature-owned content/core modules.

2. `Extract options project review modules`
   - First slice done in this pass: Graphic Assets rendering lives in `src/options/options-media.js`; Privacy Document, Data Usage, Additional Fields, Product Details category, and language diagnostics live in `src/options/options-review-tables.js`; `src/options/options.js` is back under the file-size budget.
   - Second slice done in this pass: options styles are split across `src/options/options.css`, `src/options/options-reference.css`, `src/options/options-responsive.css`, and `src/options/options-theme.css`, and each stylesheet is below the file-size budget. Remaining work: split project cards, reference content, and preferences out of `src/options/options.js` when those surfaces grow again.

3. `Continue popup module ownership`
   - First slice done in this pass: `src/popup/dashboard-page.js` owns active-tab messaging, dashboard project resolution, panel state, and media action state. Dashboard URL checks now live in `src/shared/dashboard-url.js`. Keep future popup features in focused popup-owned helpers instead of growing `src/popup/popup.js` again.

4. `Introduce WebExtension platform wrappers`
   - First slice done in this pass: `src/platform/webextension.js` centralizes direct WebExtension API access. Later split it into narrower platform modules when the source tree moves toward bundled or ES-module runtime entries.

5. `Document storage key ownership`
   - Done in this pass: `docs/storage-ownership.md`.

6. `Add modularization audit script`
   - Done in this pass: `scripts/test-modularization.ps1` reports file-size budgets, folder-density budgets, raw WebExtension API usage, and known deferrals.

## Current Release Gate

The 1.3.0.1 release-prep gate is allowed to continue with this explicit deferral because:

- The extension behavior, manifest, privacy posture, AMO listing text, and package output are already release-validated.
- The remaining modularization work is broad and behavior-sensitive.
- The debt is now documented in a tracked audit with named follow-ups.
- Future Codex work has clear ownership targets instead of a passive "use the playbook" reference.
