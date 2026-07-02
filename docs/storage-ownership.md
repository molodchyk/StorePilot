# StorePilot Storage Ownership

Last reviewed: 2026-06-26.

This document records StorePilot's persistent storage keys and ownership boundaries. It exists because the Firefox Extension Modularization Playbook requires every storage key to have an owner, shape, migration path, retention rule, quota risk, and privacy classification.

StorePilot is local-first. These records stay in the user's browser profile and are not transmitted to the StorePilot developer.

## `browser.storage.local`

| Key | Owner | Shape | Migration | Retention / pruning | Quota risk | Privacy classification |
| --- | --- | --- | --- | --- | --- | --- |
| `storePilotProjects` | Projects and import workflow | Array of project records. Each project can contain imported listings, source metadata, detected WebExtension localization metadata for CWS picker mode, category, Additional fields, Graphic Assets metadata including promo video URLs, privacy document values, last sync time, and folder-handle flags. | Current primary state. Older `storePilotListings` data is migrated into a project when no projects exist. | Retained until the user deletes a project or uses Reset local data. Project deletion also removes related handles and bindings. | Medium to high for many locales and large imported metadata, which is why `unlimitedStorage` is requested. | Imported local project metadata and user configuration. |
| `storePilotActiveProjectId` | Projects and active-project selection | String project id. | Reconciled to the first available project when missing or stale. | Retained until the active project changes, the project is deleted, or Reset local data runs. | Low. | User configuration. |
| `storePilotDashboardProjectBindings` | Dashboard project resolution | Object keyed by Chrome Web Store extension id. Values contain project id, normalized extension id, optional dashboard title/source, and update timestamp. | Supports old string values by treating them as `{ projectId }`. | Updated when the user manually links a project or StorePilot confidently resolves a dashboard title. Entries for deleted projects are pruned on project deletion. Reset local data clears all bindings. | Low. | Imported local metadata and user configuration. |
| `storePilotSettings` | Preferences | Object with UI preferences such as `theme` and `showAdvancedFillActions`. | Defaults are applied when keys are missing. | Retained until changed by the user or Reset local data runs. | Low. | User configuration. |
| `storePilotFillAllStatus` | Dashboard fill diagnostics | Object containing current fill-progress state, running flag, progress message, and status metadata. | No durable migration; stale values are treated as diagnostics only. | Updated while Fill descriptions runs and overwritten by later runs. Reset local data clears it. | Low. | Runtime diagnostics. |
| `storePilotListings` | Legacy listing import compatibility | Object mapping locale codes to listing text from pre-project StorePilot versions. | Read only as a legacy source and migrated into `storePilotProjects` when no project state exists. | Not actively written by current code. Reset local data clears it. | Medium if old installs imported many locales. | Legacy imported local metadata. |

## IndexedDB `storePilotHandles`

Database version: `2`.

| Object store | Owner | Shape | Migration | Retention / pruning | Quota risk | Privacy classification |
| --- | --- | --- | --- | --- | --- | --- |
| `handles` | Project file access | Keyed by project id. Values are browser-managed `FileSystemDirectoryHandle` objects granted by the user. | Created if missing during database upgrade. | Saved after folder import. Removed when the project is deleted or Reset local data runs. | Low metadata size, but browser permission state is sensitive. | Browser-managed local file/folder permission. |
| `mediaFiles` | Graphic Assets upload workflow | Keyed by project id. Values contain resolved `File` objects for store icon, global screenshots, locale-keyed localized screenshot arrays, small promo, marquee promo, and a save timestamp. | Created in database version 2 if missing. Existing records without `localizedScreenshots` are treated as having an empty localized screenshot map. | Saved when media files are selected or resolved from a project folder. Removed when the project is deleted or Reset local data runs. | High for projects with many localized screenshot locales because CWS can support dozens of locales with up to five screenshots each. | Browser-managed local file references for user-selected media. |

## Dashboard Page `window.localStorage`

These keys are stored on the Chrome Web Store Developer Dashboard page origin by the content script. They are convenience UI state, not imported project data.

| Key | Owner | Shape | Migration | Retention / pruning | Quota risk | Privacy classification |
| --- | --- | --- | --- | --- | --- | --- |
| `storePilotPanelPosition` | Dashboard panel UI | JSON object with panel position coordinates. Invalid JSON is ignored. | No migration. Missing or invalid values fall back to default placement. | Retained by the dashboard page origin until the browser/site data for that origin is cleared. Not part of extension Reset local data because it is page-origin storage. | Low. | Runtime UI convenience state. |
| `storePilotPanelMode` | Dashboard panel UI | String: `expanded`, `minimized`, or `hidden`. Unknown values normalize to `expanded`. | No migration. | Retained by the dashboard page origin until the browser/site data for that origin is cleared. Not part of extension Reset local data because it is page-origin storage. | Low. | Runtime UI convenience state. |

## Reset Behavior

`storePilotResetLocalData()` clears browser extension local storage and IndexedDB handle/media stores. It removes imported projects, preferences, dashboard bindings, folder permissions, and media file handles from the extension profile.

Dashboard page `window.localStorage` panel position and mode are intentionally separate page-origin convenience state. They do not contain imported project data.

## Ownership Notes

- New persistent keys must be added to this document in the same change that introduces the key.
- Storage key renames need a migration and tests.
- New large or binary state should prefer IndexedDB with explicit project-level pruning.
- New cross-dashboard state should identify whether it belongs in extension storage or page-origin storage before implementation.
