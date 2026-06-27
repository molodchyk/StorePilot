# StorePilot Project Reference

This document mirrors the StorePilot Options > Reference tab. Use it as the pasteable project-structure contract when asking Codex or another assistant to prepare Chrome Web Store automation files for StorePilot.

Run `scripts\test-reference-sync.ps1` after changing this file or the in-app Reference tab.

## Project Import Reference

Start with one locale file if the extension only has one Chrome Web Store language today. Keep media, category, additional fields, and privacy files beside it so the same project can grow into more locales later.

```text
my-extension/
manifest.json
src/
_locales/
store-listing/
  chrome-web-store/
    listing/
      en.txt
      # Add de.txt, fr.txt, pt_BR.txt, etc. later.
    media/
      icon-128.png
      screenshots/
        01-main.png
        02-settings.png
        de/
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

Folder names such as `store-listing`, `chrome-web-store`, `listing`, `media`, `screenshots`, `promo`, `assets`, `store-assets`, and `icons` help StorePilot pick the right files when a project contains extra build output.

## Detailed Description Text

`store-listing/chrome-web-store/listing/en.txt` is the recommended direct locale listing file and is copied verbatim into the Chrome Web Store Detailed description field.

The file should contain only the final detailed description body users should see in the store listing.

Do not include the extension name or a title.

Do not include field labels such as `Name`, `Summary`, `Description`, or `Detailed Description`.

Do not include Markdown headings.

Do not put the short summary in this file.

Use `.txt` for new direct listing files. StorePilot can still import `.md`, but do not create `.md` files for direct listings because Markdown headings, labels, and title-like content are copied into the dashboard.

Example `en.txt` content:

```text
Choose what opens when you create a new tab.

Use a website, local HTML file, browser page, or a quiet blank page.
```

Accepted detailed-description file examples:

- `en.txt`
- `store-listing/chrome-web-store/listing/en.txt`
- `en_US.txt`
- `de.txt`
- `pt_BR.txt`

Supported for existing plain-text files, but not recommended for new direct listing files:

- `en.md`
- `de.md`
- `pt_BR.md`

## Alternative Single-Draft Import

StorePilot also accepts `docs/chrome-web-store.md` for a single English draft.

Only in this draft file, StorePilot may look for a `Detailed Description` or `Description` section and import that section as English detailed description text.

This section parsing does not apply to direct locale listing files such as `store-listing/chrome-web-store/listing/en.txt`.

## Fields Not Imported From `listing/en.txt`

These fields belong in the Chrome Web Store dashboard or in dedicated automation documents, not in locale listing files:

- Name
- Summary
- Category
- Homepage URL
- Support URL
- Official URL
- Mature content
- Privacy fields

## Graphic Assets

Use `.png`, `.jpg`, or `.jpeg` files.

- `icon-128.png` or `icon128.png`: 128 x 128
- `screenshots/01-name.png`: global screenshot, 1280 x 800 or 640 x 400, up to 5 direct files
- `screenshots/<locale>/01-name.png`: localized screenshot, 1280 x 800 or 640 x 400, up to 5 per locale
- `promo/small-promo.png`: 440 x 280
- `promo/marquee-promo.png`: 1400 x 560

Direct files under `media/screenshots/` are global screenshots. Locale folders under `media/screenshots/<locale>/` are localized screenshots only; `media/screenshots/en/` is English localized screenshots, not a global fallback.

## Additional Fields Document Reference

StorePilot can scan one project document for Chrome Web Store Additional fields values. Keep these outside locale listing files so the detailed description body stays clean.

Recommended filename: `docs/chrome-web-store-additional-fields.md`.

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

Omit a key or leave it blank when StorePilot should not touch that dashboard field.

Use `none` for URL fields only when you want StorePilot to clear or select no URL.

For `mature_content`, use `yes` to turn the switch on or `no` to turn it off. `none`, blank, or omitted means do not touch the switch.

## Category Automation Document Reference

StorePilot can scan one project document for the Chrome Web Store category. Use an explicit Selected category line so the scanner does not infer from notes or option lists.

Recommended filename: `docs/chrome-web-store-category.md`.

```text
Chrome Web Store Category Decision
Selected category: Functionality and UI

Reason:
The extension changes browser new-tab behavior and gives users a small interface for configuring that behavior.
```

The file should contain `Selected category:` followed by one visible Chrome Web Store category label.

### Chrome Web Store Category Labels

Productivity:

- Communication
- Developer Tools
- Education
- Tools
- Workflow and planning

Lifestyle:

- Art & Design
- Entertainment
- Games
- Household
- Just for fun
- News & Weather
- Shopping
- Social Networking
- Travel
- Wellbeing

Make Chrome Yours:

- Accessibility
- Functionality and UI
- Privacy & Security

## Privacy Automation Document Reference

StorePilot can scan one project document for Chrome Web Store privacy fields. Use these canonical keys so the scanner can route text without guessing.

Recommended filename: `docs/chrome-web-store-privacy-form.md`.

```text
[privacy]
single_purpose:
...

permission.storage:
...

permission.alarms:
...

host_permission:
...

remote_code:
no

privacy_policy_url:
https://example.com/privacy

data_usage.personally_identifiable_information:
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

For permission justifications, use `permission.<manifest permission code>`. The suffix should match the code in your manifest `permissions`, `optional_permissions`, `host_permissions`, or `content_scripts.matches`.

If a permission is not listed here, use the same pattern anyway, for example `permission.bookmarks` or `permission.system.display`. StorePilot should treat the manifest code itself as the source of truth.

For remote code, use `remote_code` as the Chrome Web Store yes/no answer.

Use `no` when all code is packaged locally, and do not include `remote_code_justification` for that case.

Use `yes` only when the extension uses remote code, and then provide `remote_code_justification` for the required justification textarea.

For data usage checkboxes, answer the exact Chrome Web Store public disclosure question: what user data do you plan to collect from users now or in the future?

Treat collect as data that leaves local-only browser/device processing and is received, uploaded, logged, reviewed, or otherwise made available to the developer, a product backend, analytics, support, or a third-party service.

These keys are not permission justifications and are not a list of data the extension can access or store locally.

Use `yes` only for developer or third-party collection cases.

For local-only features where data stays on the user's device, use `no`; for example, a local history vault can need `permission.history` while still using `data_usage.web_history: no`.

StorePilot applies explicit `yes`/`no` values: `yes` checks a box, `no` unchecks it; `none`, blank, or omitted leaves it unchanged.

### Core Keys

- `single_purpose`
- `remote_code`
- `remote_code_justification`
- `privacy_policy_url`
- `host_permission`

### Data Usage Keys

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

### Common Permission Keys

- `permission.storage`
- `permission.alarms`
- `permission.downloads`
- `permission.activeTab`
- `permission.scripting`
- `permission.tabs`
- `permission.notifications`
- `permission.contextMenus`
- `permission.declarativeNetRequest`
- `permission.declarativeNetRequestWithHostAccess`
- `permission.sidePanel`
- `permission.cookies`
- `permission.webRequest`
- `permission.webNavigation`
- `permission.identity`
- `permission.offscreen`
- `permission.nativeMessaging`
- `permission.debugger`
