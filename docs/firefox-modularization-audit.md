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
| `src/content/dashboard-helper.js` | Dashboard detection, panel UI, selector strategy, description fill, category fill, Additional fields, privacy, Data usage, media upload coordination | Major architecture debt. This is the main content-script runtime and still owns multiple feature behaviors that should move into feature modules. |
| `src/content/media-upload-main-world.js` | Narrow page-world upload bridge | Acceptable as a focused page bridge. |
| `src/popup/popup.js` | Popup state, project selection, dashboard messaging, and action availability | Over the preferred UI-module budget; should be split after dashboard feature boundaries exist. |
| `src/options/options.js` | Options-page import flow, project views, previews, reset, preferences, and rendering | Major architecture debt. It still owns too much UI rendering and state coordination for one surface file. |
| `src/options/options.css` | Options-page layout and component styling | Major architecture debt. It should be split into surface layout plus feature/component styles. |

Feature and shared modules already present:

- `src/shared/additional-fields-doc.js`
- `src/shared/category-doc.js`
- `src/shared/directory-detection.js`
- `src/shared/importers.js`
- `src/shared/media-assets.js`
- `src/shared/privacy-doc.js`
- `src/shared/projects.js`
- `src/shared/storage.js`

These modules are useful migration footholds, but they are still broad shared modules rather than feature-owned `features/*/core`, `features/*/content`, `features/*/popup`, and `features/*/options` modules.

Browser/platform boundary inspected:

- StorePilot uses Firefox's `browser.*` API through the global `STOREPILOT_API`.
- Storage helpers exist in `src/shared/storage.js`.
- Raw runtime, tabs, scripting, and storage calls still appear in runtime files such as `src/background.js`, `src/popup/popup.js`, `src/options/options.js`, and `src/content/dashboard-helper.js`.
- A future migration should introduce narrow `src/platform/webextension/*` wrappers before adding more browser API calls.

Storage and migration ownership inspected:

- Project state, active-project state, dashboard project bindings, imported listing data, handles, and media file references are visible in `src/shared/storage.js`, `src/shared/handles.js`, and `src/shared/constants.js`.
- Storage ownership is documented in `docs/storage-ownership.md` with owner, data shape, migration path, retention, quota risk, and privacy classification for each current key/store.

Test coverage inspected:

- `test/project-resolution.test.js` covers dashboard project-id resolution and binding selection.
- Release scripts validate manifest paths, locale shape, privacy/AMO text, packaging, zip paths, remote-code-like patterns, source upload contents, reference sync, and Firefox temporary load.
- There is not yet enough feature-owned coverage to safely split dashboard fill, media upload, privacy/Data usage fill, or options rendering in one broad refactor.

## Named Follow-Ups

1. `Split dashboard fill feature modules`
   - Move description fill, category fill, Additional fields fill, privacy fill, Data Usage fill, selector diagnostics, and dashboard panel rendering out of `src/content/dashboard-helper.js` into feature-owned content/core modules.

2. `Extract options project review modules`
   - Move options-page project cards, Product Details, Graphic Assets, Additional Fields, Privacy Document, Data Usage, Projects, Reference, and Preferences rendering into smaller feature-owned modules and split `src/options/options.css` by surface/component.

3. `Introduce WebExtension platform wrappers`
   - Add narrow wrappers for runtime, tabs, scripting, storage, i18n, and action behavior so new feature modules do not call raw `browser.*` APIs directly.

4. `Document storage key ownership`
   - Done in this pass: `docs/storage-ownership.md`.

5. `Add modularization audit script`
   - Done in this pass: `scripts/test-modularization.ps1` reports file-size budgets, folder-density budgets, raw WebExtension API usage, and known deferrals.

## Current Release Gate

The 1.3.0.1 release-prep gate is allowed to continue with this explicit deferral because:

- The extension behavior, manifest, privacy posture, AMO listing text, and package output are already release-validated.
- The remaining modularization work is broad and behavior-sensitive.
- The debt is now documented in a tracked audit with named follow-ups.
- Future Codex work has clear ownership targets instead of a passive "use the playbook" reference.
