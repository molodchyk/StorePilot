# Firefox Modularization Audit

Last reviewed: 2026-06-18.

Result: deferred with reason.

This audit satisfies the Firefox Extension Playbook architecture and modularization gate for the StorePilot 1.3.1 release-prep pass. StorePilot has useful shared modules and release scaffolding, but the current source tree is not yet compliant with the Firefox Extension Modularization Playbook's target architecture.

File size and flat folder density are active architecture constraints. New source files over the soft budget or tracked repository folders over the flat-file budget must be split or explicitly named in this audit with a reason. Generated output and one-file locale folders are not useful density signals and are excluded from the script.

## Reason For Deferral

StorePilot now satisfies the current file-size and flat-folder-density budgets, and the former large dashboard, options, popup, style, and document-parser surfaces have been split into focused modules. The remaining gap is architectural shape: StorePilot is still a manifest-loaded global-script extension rather than the modularization playbook's full feature-first ES-module target with thin entry files, feature-owned tests, and generated Firefox output.

Moving to that final shape would require a build/runtime loading migration across background, content, popup, and options surfaces. That is broader than release-prep hygiene and should happen as a separate, behavior-protected migration.

## Source Tree Evidence

Runtime entry and surface files inspected:

| File | Current role | Audit result |
| --- | --- | --- |
| `src/background.js` | Background message handling, media upload orchestration, action-click behavior | Slightly over the entry-file budget and still owns browser API orchestration directly. |
| `src/content/dashboard-helper.js` | Dashboard section detection, active-project resolution, settings load, abort handling, diagnostics, message routing, and startup orchestration | Under the file-size budget after focused content splits. This remains the dashboard orchestration entry and should stay thin: selector, fill, panel, and media behavior belong in the focused modules below. |
| `src/content/dashboard-dom.js` | Focused content-script DOM visibility, text, form-fill, click activation, and timing helpers loaded before feature modules | Acceptable focused content utility module. Keep generic content DOM/form mechanics here instead of growing `src/content/dashboard-helper.js`. |
| `src/content/language/locale.js` | Focused locale normalization, CWS locale alias matching, and visible-language text matching helpers | Acceptable focused language helper. Keep locale-code and language-label matching here so CWS and future AMO language flows share the same assumptions. |
| `src/content/language/picker.js` | Focused Chrome Web Store language dropdown discovery, two-mode picker detection, option enumeration, and option activation | Acceptable focused language-picker helper. It preserves the separate multi-locale top-picker and one-language Product Details picker modes. |
| `src/content/language/description-fill.js` | Focused Chrome Web Store listing description fill flow, fill-progress status, and current/all-language fill actions | Acceptable focused dashboard-fill helper. Keep description-fill status and selection flow here instead of growing `src/content/dashboard-helper.js`. |
| `src/content/dashboard-category.js` | Focused Chrome Web Store category dropdown matching and selection behavior | Acceptable focused dashboard-fill content helper. Keep category selector changes here instead of growing `src/content/dashboard-helper.js`. |
| `src/content/dashboard-additional-fields.js` | Focused Chrome Web Store Additional fields matching and filling behavior | Acceptable focused dashboard-fill content helper. Keep Official URL, Homepage URL, Support URL, and Mature content fill changes here instead of growing `src/content/dashboard-helper.js`. |
| `src/content/dashboard-privacy-core.js` | Focused privacy/data-usage normalization and active privacy field access | Acceptable focused dashboard privacy helper. Keep shared privacy form normalization here. |
| `src/content/dashboard-privacy-data-usage.js` | Focused Chrome Web Store Data Usage checkbox mapping and checked-state changes | Acceptable focused dashboard privacy helper. Keep Data Usage disclosure checkbox changes here. |
| `src/content/dashboard-privacy-fields.js` | Focused Chrome Web Store privacy field, permission justification, and remote-code radio fill behavior | Acceptable focused dashboard privacy helper. Keep privacy text/radio field changes here. |
| `src/content/dashboard-media.js` | Focused Chrome Web Store media upload, clear, diagnostics, and page-bridge coordination behavior | Acceptable focused content helper. Keep Graphic Assets upload and removal changes here instead of growing `src/content/dashboard-helper.js`. |
| `src/content/panel/state.js` | Focused dashboard panel mode, position, viewport clamp, media button state, and media-operation lock behavior | Acceptable focused panel helper. Keep panel state and operation lock mechanics here instead of returning them to `src/content/dashboard-helper.js`. |
| `src/content/panel/render.js` | Focused dashboard panel DOM construction for listing and privacy pages | Acceptable focused panel helper. Keep panel button layout and per-page panel rendering here. |
| `src/content/dashboard-panel-styles.js` | Focused dashboard panel CSS injector loaded before the main content helper | Acceptable focused content UI helper. Keep panel styling changes here instead of growing `src/content/dashboard-helper.js`. |
| `src/content/media-upload-main-world.js` | Narrow page-world upload bridge | Acceptable as a focused page bridge. |
| `src/popup/popup.js` | Popup state, project selection, action handlers, and action availability | Second split done. This file is now under the preferred UI-module budget after dashboard page behavior moved to `src/popup/dashboard-page.js` and popup settings/theme behavior moved to `src/popup/settings.js`. |
| `src/popup/dashboard-page.js` | Popup-owned active-tab messaging, dashboard project binding resolution, panel visibility, and media action state | Acceptable focused popup helper. It now uses shared dashboard URL helpers instead of owning URL parsing directly. Keep this separate from content-script selector and fill logic. |
| `src/popup/settings.js` | Popup-owned settings load/save, theme selection, and advanced fill action visibility | Acceptable focused popup helper. Keep storage-backed popup preferences here instead of growing `src/popup/popup.js`. |
| `src/options/options.js` | Options-page state coordination, import flow, project cards, preferences, reset, and event wiring | First split done. This file is now under the preferred UI-module budget after media preview/rendering moved to `src/options/options-media.js` and privacy/category/additional/data-usage review tables moved to `src/options/options-review-tables.js`. |
| `src/options/options-media.js` | Options-page Graphic Assets preview overlay, media cards, media summaries, and media file handle previews | Acceptable focused options helper. |
| `src/options/options-review-tables.js` | Options-page Privacy Document, Data Usage, Additional Fields, Product Details category, and language-diagnostic review tables | Acceptable focused options helper. |
| `src/options/options.css` | Core options-page layout, controls, status cards, tabs, tables, and media cards | First split done. This file is now under the stylesheet budget after modal/reference, responsive, and theme rules moved to focused CSS files. |
| `src/options/options-reference.css` | Options-page media review modal and Reference tab styles | Acceptable focused stylesheet. |
| `src/options/options-responsive.css` | Options-page responsive layout rules | Acceptable focused stylesheet. |
| `src/options/options-theme.css` | Options-page system, dark, and light theme overrides | Acceptable focused stylesheet. |

Feature and shared modules already present:

- `src/shared/store-docs/additional-fields-doc.js`
- `src/shared/store-docs/category-doc.js`
- `src/shared/dashboard-url.js`
- `src/shared/directory-detection.js`
- `src/shared/importers.js`
- `src/shared/media-assets.js`
- `src/shared/store-docs/privacy-doc.js`
- `src/shared/projects.js`
- `src/shared/storage.js`
- `src/content/dashboard-dom.js`
- `src/content/language/locale.js`
- `src/content/language/picker.js`
- `src/content/language/description-fill.js`
- `src/content/dashboard-category.js`
- `src/content/dashboard-additional-fields.js`
- `src/content/dashboard-privacy-core.js`
- `src/content/dashboard-privacy-data-usage.js`
- `src/content/dashboard-privacy-fields.js`
- `src/content/dashboard-media.js`
- `src/content/panel/state.js`
- `src/content/panel/render.js`
- `src/content/dashboard-panel-styles.js`
- `src/popup/dashboard-page.js`
- `src/popup/settings.js`

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
- There is not yet enough feature-owned coverage to safely convert the classic global-script runtime into ES modules and generated Firefox output in one broad refactor.

## Named Follow-Ups

1. `Split dashboard fill feature modules`
   - First content split done in this pass: dashboard panel CSS injection now lives in `src/content/dashboard-panel-styles.js`.
   - Second content split done in this pass: `src/content/dashboard-helper.js` reuses `src/shared/store-docs/category-doc.js` and `src/shared/store-docs/privacy-doc.js` constants for category options, Data Usage keys, and certification keys.
   - Third content split done in this pass: dashboard project binding and title matching now delegate to `src/shared/storage.js`, which is covered by `test/project-resolution.test.js`.
   - Fourth content split done in this pass: generic content DOM/form helpers now live in `src/content/dashboard-dom.js`.
   - Fifth content split done in this pass: category dropdown detection and selection now live in `src/content/dashboard-category.js`.
   - Sixth content split done in this pass: Additional fields detection and filling now live in `src/content/dashboard-additional-fields.js`.
   - Seventh content split done in this pass: privacy form normalization, Data Usage checkbox filling, permission justification filling, and remote-code radio behavior now live in `src/content/dashboard-privacy-core.js`, `src/content/dashboard-privacy-data-usage.js`, and `src/content/dashboard-privacy-fields.js`.
   - Eighth content split done in this pass: Graphic Assets upload, clear, diagnostics, and page-bridge coordination now live in `src/content/dashboard-media.js`.
   - Ninth content split done in this pass: locale normalization, two-mode language picker detection, option activation, description-field detection, and Fill descriptions progress handling now live in `src/content/language/locale.js`, `src/content/language/picker.js`, and `src/content/language/description-fill.js`.
   - Tenth content split done in this pass: dashboard panel state, viewport clamping, media button state, media-operation locking, and listing/privacy panel rendering now live in `src/content/panel/state.js` and `src/content/panel/render.js`.
   - Remaining work: move selector diagnostics and message routing into narrower modules if those surfaces grow again. `src/content/dashboard-helper.js` is now under the current file-size budget.

2. `Extract options project review modules`
   - First slice done in this pass: Graphic Assets rendering lives in `src/options/options-media.js`; Privacy Document, Data Usage, Additional Fields, Product Details category, and language diagnostics live in `src/options/options-review-tables.js`; `src/options/options.js` is back under the file-size budget.
   - Second slice done in this pass: options styles are split across `src/options/options.css`, `src/options/options-reference.css`, `src/options/options-responsive.css`, and `src/options/options-theme.css`, and each stylesheet is below the file-size budget. Remaining work: split project cards, reference content, and preferences out of `src/options/options.js` when those surfaces grow again.

3. `Continue popup module ownership`
   - First slice done in this pass: `src/popup/dashboard-page.js` owns active-tab messaging, dashboard project resolution, panel state, and media action state. Dashboard URL checks now live in `src/shared/dashboard-url.js`. Keep future popup features in focused popup-owned helpers instead of growing `src/popup/popup.js` again.
   - Second slice done in this pass: `src/popup/settings.js` owns popup settings persistence, theme button state, and advanced fill action visibility. Runtime load tests now require it to load before `src/popup/popup.js`.

4. `Introduce WebExtension platform wrappers`
   - First slice done in this pass: `src/platform/webextension.js` centralizes direct WebExtension API access. Later split it into narrower platform modules when the source tree moves toward bundled or ES-module runtime entries.

5. `Document storage key ownership`
   - Done in this pass: `docs/storage-ownership.md`.

6. `Add modularization audit script`
   - Done in this pass: `scripts/test-modularization.ps1` reports file-size budgets, folder-density budgets, raw WebExtension API usage, and known deferrals.

## Current Release Gate

The 1.3.1 release-prep gate is allowed to continue with this explicit deferral because:

- The extension behavior, manifest, privacy posture, AMO listing text, and package output are already release-validated.
- The current source tree passes file-size and flat-folder-density checks.
- The remaining modularization work is the broader ES-module/feature-folder migration, which is behavior-sensitive.
- The debt is now documented in a tracked audit with named follow-ups.
- Future Codex work has clear ownership targets instead of a passive "use the playbook" reference.
