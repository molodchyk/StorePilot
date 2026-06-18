# Firefox Extension Modularization Playbook

This playbook captures a Firefox-first version of the extension modularization standard. It is written so Codex can create or reshape WebExtensions without copying Chrome-only assumptions into Firefox projects.

This is a prescriptive target, not a description of whatever structure a current extension happens to have. Existing projects can migrate toward it in small verified steps.

The goal is not prettier folders. The goal is to keep a Firefox extension maintainable as it grows: small modules, explicit ownership, tested core logic, bounded permissions, restart-safe background behavior, AMO-ready packaging, and clear browser API boundaries.

## Core Principle

Use feature-first modules with thin runtime entry points.

Runtime entry files should bootstrap and wire. They should not own business logic. Feature modules should own product behavior and nearby UI assets. Shared core modules should be pure and testable. Platform modules should own browser APIs, Firefox quirks, manifest differences, and permission-specific behavior.

The best default is:

1. group by feature or product responsibility;
2. split by runtime surface inside that feature when needed;
3. keep runtime entry files thin;
4. use generated output to satisfy manifest and browser loading rules instead of letting those rules define the source tree.

Do not organize a mature extension primarily by file type. Product behavior should be discoverable by feature, not by hunting across global type folders.

## Firefox Compatibility Rules

Firefox compatibility is an architecture concern, not only a manifest setting.

- Prefer the Promise-based `browser.*` WebExtension API in authored source.
- If `chrome.*` is needed for compatibility with copied code or cross-browser output, isolate it behind `platform/webextension/*` wrappers.
- Keep `browser_specific_settings.gecko` and `browser_specific_settings.gecko_android` deliberate and documented.
- Validate the minimum Firefox version against the APIs and manifest keys actually used.
- Do not assume Chrome MV3 service-worker behavior. Firefox MV3 background support can use a different background implementation shape.
- Keep Chrome-only APIs, Chrome dashboard automation selectors, and Chrome Web Store policy language out of generic platform modules.
- Treat AMO source submission and extension ZIP output as release contracts.

Firefox-first projects should still be modular source-first projects. The manifest and packaged output are runtime contracts, not the source architecture.

## Recommended Source Shape

A mature Firefox extension should use this shape as its target. New extensions should start close to it. Existing extensions measure migration distance against it.

```text
src/
  app/
    background/
      index.js
      messageRouter.js
    content/
      index.entry.js
      pageBridge.entry.js
    popup/
      popup.html
      index.js
      popup.css
    options/
      options.html
      index.js
      options.css
    pages/
      page-name/
        page.html
        index.js
        page.css

  features/
    feature-name/
      README.md
      core/
        model.js
        validation.js
        validation.test.js
      background/
        runtime.js
        messages.js
      content/
        adapter.js
        effects.js
        effects.css
      ui/
        FeaturePanel.js
        FeaturePanel.css
        FeaturePanel.test.js
      popup/
        FeatureCard.js
        FeatureCard.css
      options/
        FeatureSettings.js
        FeatureSettings.css
      i18n/
        messages.js

  platform/
    webextension/
      runtime.js
      storage.js
      tabs.js
      scripting.js
      permissions.js
    firefox/
      manifest.js
      geckoSettings.js
      amoPackage.js
    dom/
      createElement.js
      formControls.js
      theme.js
    diagnostics/
      logger.js

  shared/
    compatibility-barrels.js

  legacy/
    migration/
      oldStorageKeys.js
      oldSettings.js

dist/
  firefox/
    manifest.json
    background.js
    content.js
    popup.html
    options.html
```

This is the target shape. Existing projects may reach it gradually, but gradual migration is a delivery tactic, not a competing architecture.

## ES Modules And Build Target

Author source as ES modules by default. The source tree should be modular first and manifest-compatible second; generated output handles the browser contract.

Best-practice target:

- `src` is human-authored source.
- `dist/firefox` is generated or validated Firefox extension output.
- Feature code uses static ES imports and exports.
- Runtime entries import feature modules and wire them.
- Content-script source is modular, even when the final manifest loads bundled or flattened output.
- Extension pages use module scripts when supported by the project target.
- Build output is audited before release.

The build step is not the architecture. The architecture is feature ownership and explicit boundaries. The build step exists to preserve that architecture while satisfying Firefox WebExtension loading rules.

Avoid remote executable code. Dependencies may be bundled, but executable JavaScript and WebAssembly used by the extension must be included in the extension package.

TypeScript is useful once the extension has growing schemas, runtime messages, storage records, and cross-surface contracts. If a project stays in JavaScript, it should keep equivalent schema validation and tests.

## Manifest And Background Rules

Manifest paths are runtime contracts.

Rules:

- Keep manifest generation or manifest validation explicit.
- Keep Firefox-specific manifest settings in a narrow manifest/platform module or build script.
- Treat `browser_specific_settings.gecko.id`, `strict_min_version`, and Android support as release decisions.
- If targeting more than Firefox, generate per-browser manifests instead of compromising the source tree.
- For cross-browser MV3 background output, support both Firefox and service-worker-style browsers intentionally rather than assuming one shape fits all.

Background code must be restart-safe.

Rules:

- Treat memory as cache only.
- Persist state needed after restart.
- Make initialization idempotent.
- Keep listener registration and storage reconciliation in focused modules.
- Keep message handling behind a router once it grows beyond a few actions.

Test target:

- The feature should be able to reconstruct runtime state from storage after background restart or extension reload.

## Runtime Entry Rules

Runtime entry files include:

- background entry;
- content-script bootstrap;
- popup entry;
- options-page entry;
- extension-page entry;
- page-bridge entry when the extension must interact with the page's main world.

Rules:

- Entry files should target under 150 lines.
- Entry files should initialize modules, register listeners, and wire refresh loops.
- Entry files should not contain parsing, storage migration, selector strategy, upload automation, validation, or complex UI rendering.
- If an entry file grows, extract the new responsibility into a feature module and keep the entry as the caller.

## Feature Ownership Rules

Every meaningful behavior should have one owning feature folder.

Good feature ownership examples:

- `store-import/core/parser.js` owns imported project document parsing.
- `store-import/core/validation.js` owns imported data validation.
- `dashboard-fill/content/controller.js` owns page-level fill orchestration.
- `dashboard-fill/content/selectors.js` owns dashboard selector strategy.
- `media-upload/content/pageBridge.js` owns page-world upload mechanics.
- `projects/core/model.js` owns project identity and active-project rules.
- `privacy/core/disclosures.js` owns privacy and data usage normalization.

Avoid:

- putting unrelated helpers into a broad `utils.js`;
- placing new behavior in root `background.js`, `popup.js`, or `options.js`;
- treating global HTML, CSS, and JS folders as the primary design;
- hiding storage migrations inside UI rendering files;
- mixing dashboard selectors, storage updates, and UI rendering in one file.

## Pure Core Rule

Pure core modules are the safest place for logic.

They may:

- import other pure modules;
- normalize data;
- parse project documents;
- validate fields;
- produce display-ready summaries;
- expose deterministic functions for tests.

They must not:

- access `browser` or `chrome`;
- access `window` or `document`;
- read or write WebExtension storage directly;
- mutate DOM nodes;
- depend on timers except through injected timestamps;
- depend on real tabs, windows, or extension pages.

If a function can be pure, make it pure. Pure logic is portable and testable without Firefox.

## Platform Boundary

Platform modules own browser APIs and side effects.

Examples:

- `platform/webextension/storage.js`
- `platform/webextension/runtime.js`
- `platform/webextension/tabs.js`
- `platform/webextension/scripting.js`
- `platform/firefox/geckoSettings.js`
- `platform/dom/createElement.js`

Rules:

- Normalize `browser.*` and any fallback `chrome.*` behavior in one place.
- Normalize errors in one place.
- Keep permission-specific behavior visible.
- Return unsubscribe functions for listeners when used by cleanup-capable surfaces.
- Do not scatter raw WebExtension API calls through feature modules unless the project is still in early migration.

## Content Script Boundary

Firefox content scripts run at a boundary between the extension and the page.

Rules:

- Treat content scripts as adapters.
- Keep content-script public APIs small and named.
- Put pure logic outside content scripts when possible.
- Validate messages before privileged background actions.
- Keep selector strategy in focused modules.
- Keep page-main-world bridges narrow and auditable.
- Do not let page data or dashboard DOM state mutate extension storage without normalization.

Useful naming:

- `.entry.js` for source files that compile or copy into manifest-loaded output.
- `controller.js` for thin content controllers.
- `selectors.js`, `effects.js`, `style.js`, `messages.js`, `dom.js`, and `bridge.js` for focused sub-responsibilities.

## Message Router Rule

Messages from content scripts should be treated as untrusted input.

Every privileged message should validate:

- action name;
- sender tab/frame context;
- payload shape;
- feature policy;
- whether the requested action is allowed from that sender.

Use a message router once message handling grows. Avoid ad hoc `if (message.action === ...)` checks spread across several runtime files.

## Storage Ownership Rule

Every storage key needs an owner.

Document for each key:

- storage area;
- owner feature;
- data shape/version;
- migration path;
- retention or pruning;
- quota risk;
- whether it contains user configuration, runtime state, diagnostics, imported local metadata, or cache data.

General rule:

- Sync storage: compact user configuration and mission-critical settings.
- Local storage: larger local-first state, imported project metadata, diagnostics, and caches.
- Session or in-memory: cache data that can be lost safely.

Never rename a storage key without a migration and tests.

## CSS And HTML Structure

Use feature-owned styles with thin entry stylesheets.

Rules:

- Entry stylesheets should mostly import feature styles or define surface-level layout.
- Put styles in the narrowest feature/surface/component file.
- Keep design tokens separate from feature styles.
- HTML entry files belong to runtime surfaces such as popup, options, and extension pages.
- HTML templates that belong to one feature should live with that feature when the build pipeline can preserve that ownership.
- Content-script CSS may stay injected by content modules when page isolation or manifest compatibility requires it.

## Test Structure

Best target: tests live next to the feature logic they verify, or in a mirrored feature test folder when packaging constraints require tests outside `src`.

Rules:

- Do not create one broad `shared.test.js`.
- Add tests to the smallest matching feature folder or mirrored test folder.
- Keep most behavioral rules in pure modules so Node tests can cover them.
- Add Firefox manual or automated checks for extension-page, popup, content-script, background, and permission behavior when the change depends on real Firefox behavior.

## File Size And Folder Density Budgets

These are maintainability budgets, not browser requirements.

Suggested file targets:

- Runtime entry file: under 150 lines.
- Pure core module: 100 to 300 lines.
- UI module/component: 150 to 450 lines.
- Content-script adapter: 100 to 350 lines.
- CSS file per feature/surface/component: under 500 lines.
- Test file per feature: under 500 lines.

Escalation:

- Over 600 lines: create a follow-up split unless there is a clear reason.
- Over 900 lines: treat as architecture debt.

Suggested folder targets:

- Root runtime folders and platform folders: 12 files or fewer at each flat level before splitting.
- Feature subfolders: 15 files or fewer.
- If a folder crosses the target, split by surface or responsibility.

## Migration Strategy

Do not do a giant rename-only refactor.

Preferred migration:

1. Add guardrail docs and audits.
2. Add tests around current behavior.
3. Extract one responsibility into a new module.
4. Keep compatibility barrels or old entry wrappers.
5. Update imports only where necessary.
6. Run narrow checks.
7. Commit a small checkpoint.
8. Repeat.

Good refactor commits say what responsibility moved:

- `Split dashboard category selectors`
- `Move privacy parsing into privacy core`
- `Extract WebExtension storage wrapper`

Weak commit messages hide risk:

- `Refactor`
- `Cleanup`
- `Move stuff`

## Required Checks By Change Type

For manifest or content-script path moves:

- manifest reference check;
- import check;
- syntax check;
- Firefox load check through `about:debugging` or an automated equivalent.

For storage model changes:

- unit tests;
- migration tests;
- quota/shape review;
- privacy/storage docs update.

For background behavior:

- unit tests for pure logic;
- restart/reload reconciliation test where possible;
- message validation review.

For options or popup UI:

- unit tests for pure helpers;
- import check;
- manual Firefox check when visible layout or interaction changes.

For page automation:

- selector diagnostics;
- content-message validation;
- manual target-page check;
- failure-state reporting.

For release-facing changes:

- manifest check;
- import check;
- locale coverage check;
- package verification;
- AMO notes/source-package check when required.

## Portable Audit Scripts

Reusable script concepts:

- `audit:file-sizes`: reports files over soft/hard line budgets.
- `audit:folder-density`: reports flat folders over file-count budgets.
- `verify:manifest`: checks that manifest-referenced files exist.
- `verify:imports`: checks that relative ES-module imports resolve.
- `verify:locales`: checks locale message coverage.
- `verify:package`: checks generated extension output for remote executable code, missing files, source-map policy, and manifest/package consistency.
- `verify:amo-source`: checks that AMO source-package instructions and artifacts match the shipped extension.
- `verify:release`: runs release-specific packaging and policy checks.

When porting to another extension, copy the concept before copying exact thresholds.

## Firefox-Specific Release Constraints

Firefox extensions add constraints that ordinary web apps and Chrome-only extensions do not have:

- `browser_specific_settings.gecko` is part of the public compatibility contract.
- `gecko_android` must be deliberate when Android support is claimed.
- AMO may require source-code submission and reviewer notes for generated output.
- Data collection declarations should stay aligned with the manifest, privacy policy, and AMO listing.
- WebExtension API support depends on Firefox version, so `strict_min_version` must match the APIs used.
- Background behavior must be tested in Firefox, not inferred from Chrome.
- Content-script and page-bridge behavior must be tested against Firefox isolation rules.
- Build output, not only source, is what users and AMO reviewers inspect.

Any modularization plan that ignores these constraints is cosmetic.

## Anti-Patterns

Avoid:

- one giant `background.js`;
- one giant `content.js`;
- one giant `options.js`;
- primary source organization by file-type folders;
- broad `utils.js` modules;
- tests collected into a single huge file;
- storage mutations hidden in render functions;
- raw `browser.*` or `chrome.*` calls scattered everywhere;
- content scripts that own core business rules;
- background handlers that trust content-script messages;
- large path moves mixed with behavior changes;
- Chrome-only MV3 assumptions in Firefox projects;
- unreviewed generated output.

## Codex Operating Protocol

When Codex edits a growing Firefox extension:

1. Read the local architecture docs first.
2. Identify the owning feature folder before editing.
3. If no owner exists, create a narrow feature folder rather than adding to a root runtime folder.
4. Prefer ES-module feature boundaries before adding new runtime or global helper files.
5. Keep Firefox platform behavior behind `platform/webextension` or `platform/firefox`.
6. Keep behavior changes separate from broad file moves.
7. Add or update tests in the feature's test area.
8. Run the narrowest relevant checks.
9. Update code-structure docs when ownership changes.

Default decision:

- New UI behavior: feature-owned `ui`, `options`, `popup`, or `content` module.
- New parsing/validation behavior: feature `core` module.
- New WebExtension API access: `platform/webextension` or a background feature adapter.
- New Firefox-specific manifest or release behavior: `platform/firefox` or the release/build script.
- New persistent data: feature storage model plus migration note.
- New diagnostics: feature diagnostics module plus privacy boundary.
- New CSS: colocated feature/component stylesheet.

## Healthy End State

A healthy Firefox extension codebase has:

- feature-owned modules;
- colocated feature UI, styles, and tests in source;
- thin runtime entries;
- pure tested core logic;
- explicit WebExtension and Firefox wrappers;
- documented storage ownership;
- bounded diagnostics;
- feature-owned tests;
- import and manifest checks;
- AMO/source-package checks;
- file-size and folder-density audits;
- architecture docs that match the current tree.

This makes future Codex work cheaper: the next change has an obvious home, a local test area, and a clear set of checks.

## References

- [Firefox Localization Reference](firefox-localization.md)
- [MDN: manifest.json background](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background)
- [MDN: browser_specific_settings](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings)
- [MDN: Content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts)
- [Firefox Extension Workshop: Manifest V3 migration guide](https://extensionworkshop.com/documentation/develop/manifest-v3-migration-guide/)
