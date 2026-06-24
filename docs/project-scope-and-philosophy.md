# Project Scope And Philosophy

## Purpose

StorePilot exists to reduce repetitive, error-prone browser extension store maintenance work. It takes source-controlled listing, media, and privacy-form material from real extension projects and helps place that content into store dashboards without turning publishing into a fragile manual copy/paste ritual.

The product should feel like a careful cockpit for release work, not like a bot that takes publishing authority away from the user.

## Product Philosophy

- Local first: imported listing text, media references, privacy-form text, preferences, and folder handles stay in browser-managed local storage.
- Human in control: StorePilot can fill fields and upload selected assets, but it should not click final publish or submit actions automatically.
- Project aware: one browser extension project should remain one StorePilot project, even if the user imports a nested listing folder.
- Flexible import: users should be able to choose the project root, a store-listing folder, a dashboard-specific listing folder, or direct listing files.
- Transparent status: long-running actions should show concrete progress, exact failures, retries, skipped fields, and recovery results.
- Conservative automation: automate reversible and reviewable steps first. Avoid irreversible store actions.

## Current Scope

StorePilot currently focuses on:

- Browser extension store listing text.
- Flat locale files named by locale, preferably plain `.txt` files such as `en.txt`, `de.txt`, and `pt_BR.txt`.
- Multi-project local storage.
- Chrome Web Store Developer Dashboard listing fields.
- Chrome Web Store Developer Dashboard additional product fields.
- Chrome Web Store Developer Dashboard media assets.
- Chrome Web Store Developer Dashboard privacy fields.

## Out Of Scope For Now

- Clicking final submit, publish, or irreversible review actions.
- Handling credentials or authentication.
- Remote cloud project storage.
- Automatically publishing through store APIs.
- Automatically uploading extension packages.
- Full support for AMO, Edge Add-ons, or other store dashboards.
- Guaranteeing compatibility with future Chrome Web Store UI changes without inspection and adjustment.

## Design Intent

StorePilot should prefer dense, operational UI over marketing-style surfaces. The user is doing release work and needs clear controls, visible state, compact project navigation, and exact feedback.

Project selection should be available where the user is making project-specific decisions. A project list belongs near the top of the options page, above imported listings, because it is navigation context rather than archive/footer content.

Long-running operations should be resilient to UI rerenders, popup close/reopen, and theme changes. Runtime state should be represented as state, not only as button visibility in a single DOM instance.

## Safety Principles

- Never publish automatically.
- Never click a final submit/save/publish button without explicit user instruction for that exact action.
- Prefer filling text fields, uploading reviewable media, and reporting completion.
- Keep abort operations idempotent and non-scary.
- Treat user-requested abort as a normal stopped state, not an error.
- Name specific failed languages, fields, or media assets.
- Enforce known dashboard limits, including the five-screenshot Chrome Web Store limit.
