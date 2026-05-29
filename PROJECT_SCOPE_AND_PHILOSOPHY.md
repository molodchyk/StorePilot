# Project Scope And Philosophy

## Purpose

StorePilot exists to reduce repetitive, error-prone browser extension store maintenance work. Its first useful job is localized listing management: take source-controlled locale files from real extension projects and help place that text into store dashboards without turning publishing into a fragile manual copy/paste ritual.

The product should feel like a careful cockpit for release work, not like a bot that takes publishing authority away from the user.

## Product Philosophy

- Local first: imported listing text stays in browser extension storage unless the user explicitly submits, copies, or exports it.
- Human in control: StorePilot can fill fields, but it should not click final publish or submit actions automatically.
- Project aware: one browser extension project should remain one StorePilot project, even if the user imports a nested listing folder.
- Flexible import: users should be able to choose the project root, a store-listing folder, a dashboard-specific listing folder, or direct listing files.
- Transparent status: long-running actions should show concrete progress, exact failures, retries, and recovery results.
- Conservative automation: automate reversible and reviewable steps first. Avoid irreversible store actions.
- Browser honest: do not pretend Chrome can script Chrome Web Store pages when Chrome explicitly blocks it.

## Current Scope

StorePilot currently focuses on:

- Browser extension store listing text.
- Flat locale files named by locale, for example `en.txt`, `de.md`, `pt_BR.markdown`.
- Multi-project local storage.
- Firefox automation of the Chrome Web Store Developer Dashboard.
- Chrome-side project management and copy-to-clipboard fallback.

The Firefox distribution is the practical target for dashboard automation. Chrome remains useful for local project management but cannot automate Chrome Web Store dashboard fields.

## Out Of Scope For Now

- Clicking final submit, publish, or irreversible review actions.
- Handling credentials or authentication.
- Remote sync or cloud project storage.
- Automatically publishing through store APIs.
- Automatically uploading extension packages, screenshots, or promo images.
- Full support for Firefox AMO, Edge Add-ons, or other store dashboards.
- Guaranteeing compatibility with future Chrome Web Store UI changes without inspection and adjustment.

## Design Intent

StorePilot should prefer dense, operational UI over marketing-style surfaces. The user is doing release work and needs clear controls, visible state, compact project navigation, and exact feedback.

Project selection should be available where the user is making project-specific decisions. A project list belongs near the top of the options page, above imported listings, because it is navigation context rather than archive/footer content.

Long-running fill-all operations should be resilient to UI rerenders, popup close/reopen, and theme changes. Runtime state should be represented as state, not only as button visibility in a single DOM instance.

## Safety Principles

- Never publish automatically.
- Never click a final submit/save/publish button without explicit user instruction for that exact action.
- Prefer filling text fields and reporting completion.
- Keep abort operations idempotent and non-scary.
- Treat user-requested abort as a normal stopped state, not an error.
- Name specific failed languages and retry recoverable failures once.

## Browser Constraint Philosophy

The browser is part of the product surface. If a browser blocks a capability, the UI should explain the limitation and offer the safest available fallback.

Chrome blocks extension scripts on Chrome Web Store pages. StorePilot should not fight this inside Chrome. The correct approach is:

- Chrome: import, organize, sync, copy text.
- Firefox: automate Chrome Web Store dashboard fields where Firefox permits content scripts.

This split should stay explicit in documentation and UI copy.
