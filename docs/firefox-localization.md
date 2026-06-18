# Firefox Localization

This document records the current Firefox/WebExtension and AMO localization knowledge for StorePilot-style Firefox add-on work.

Source checked: 2026-06-18.

Do not copy the Chrome Web Store locale list into Firefox work. Firefox has two different localization layers:

1. Extension runtime localization: packaged `_locales/<locale>/messages.json` files used by the WebExtensions `i18n` API.
2. AMO listing localization: localized add-on metadata and listing pages on addons.mozilla.org.

Those layers overlap, but they are not the same contract.

## Runtime Extension Localization

Runtime localization is the extension package's own i18n setup.

- If `_locales/` exists, `manifest.json` must include `default_locale`; if `_locales/` does not exist, `default_locale` must be absent.
- The first real localization step is to externalize English UI strings into `_locales/en/messages.json` and wire the extension to read them.
- Use `__MSG_key__` in `manifest.json` for localized manifest strings.
- Use `browser.i18n.getMessage()` or the project's WebExtension wrapper for runtime strings.
- Locale tags use hyphens in normal BCP-style notation, such as `en-US`, but `_locales` directory names use underscores, such as `_locales/en_US`.
- Firefox falls back from exact locale to less specific locale to `default_locale`.
- Right-to-left locales still need real UI checks. Treat Arabic, Persian, Hebrew, and Urdu as RTL when present in runtime locales.

## AMO Listing Localization

AMO listing text is separate from extension runtime `_locales`.

Adding `_locales/de/messages.json` can localize the installed extension UI, manifest name, and manifest description, but it does not automatically create or update the German add-on listing on addons.mozilla.org. AMO listing metadata has its own language selector and own stored translated fields.

Use AMO locale codes with hyphens for listing/API/page work, for example `en-US`, `pt-BR`, and `zh-TW`. Developer Hub may display these codes lowercased, such as `en-us`, `pt-br`, and `zh-tw`; treat AMO locale matching as case-insensitive and normalize before comparing. Use underscore directory names only inside the extension package's `_locales` tree.

AMO listing fields are not plain CWS-style text fields. The summary is limited to 250 characters. The description can be longer and may use AMO's limited Markdown support, including bullets, links, bold, italic, blockquotes, and fenced code. Keep localized descriptions readable when rendered as Markdown, not only when viewed as raw text.

AMO uses one shared screenshot set for the add-on listing, while screenshot descriptions can be localized. Do not plan per-locale screenshot image uploads unless Developer Hub behavior changes.

## AMO Production Locale Coverage

The current AMO production/stage language list comes from Mozilla's `addons-server` `PROD_LANGUAGES`; production settings assign `AMO_LANGUAGES = PROD_LANGUAGES`.

The StorePilot Developer Hub page confirmed this same set on 2026-06-18. In that UI, the default locale showed as `en-us`, existing locales were locales already added to the add-on, and new locales were remaining locales that could still be added. "New" does not mean unsupported.

| AMO source locale | Developer Hub code | `_locales` folder | English name |
| --- | --- | --- | --- |
| `cs` | `cs` | `cs` | Czech |
| `de` | `de` | `de` | German |
| `dsb` | `dsb` | `dsb` | Lower Sorbian |
| `el` | `el` | `el` | Greek |
| `en-CA` | `en-ca` | `en_CA` | English (Canadian) |
| `en-GB` | `en-gb` | `en_GB` | English (British) |
| `en-US` | `en-us` | `en_US` | English (US) |
| `es-AR` | `es-ar` | `es_AR` | Spanish (Argentina) |
| `es-CL` | `es-cl` | `es_CL` | Spanish (Chile) |
| `es-ES` | `es-es` | `es_ES` | Spanish (Spain) |
| `es-MX` | `es-mx` | `es_MX` | Spanish (Mexico) |
| `fi` | `fi` | `fi` | Finnish |
| `fr` | `fr` | `fr` | French |
| `fur` | `fur` | `fur` | Friulian |
| `fy-NL` | `fy-nl` | `fy_NL` | Frisian |
| `he` | `he` | `he` | Hebrew |
| `hr` | `hr` | `hr` | Croatian |
| `hsb` | `hsb` | `hsb` | Upper Sorbian |
| `hu` | `hu` | `hu` | Hungarian |
| `ia` | `ia` | `ia` | Interlingua |
| `it` | `it` | `it` | Italian |
| `ja` | `ja` | `ja` | Japanese |
| `ka` | `ka` | `ka` | Georgian |
| `kab` | `kab` | `kab` | Kabyle |
| `ko` | `ko` | `ko` | Korean |
| `nb-NO` | `nb-no` | `nb_NO` | Norwegian (Bokmal) |
| `nl` | `nl` | `nl` | Dutch |
| `nn-NO` | `nn-no` | `nn_NO` | Norwegian (Nynorsk) |
| `pl` | `pl` | `pl` | Polish |
| `pt-BR` | `pt-br` | `pt_BR` | Portuguese (Brazilian) |
| `pt-PT` | `pt-pt` | `pt_PT` | Portuguese (Portugal) |
| `ro` | `ro` | `ro` | Romanian |
| `ru` | `ru` | `ru` | Russian |
| `sk` | `sk` | `sk` | Slovak |
| `sl` | `sl` | `sl` | Slovenian |
| `sq` | `sq` | `sq` | Albanian |
| `sv-SE` | `sv-se` | `sv_SE` | Swedish |
| `tr` | `tr` | `tr` | Turkish |
| `uk` | `uk` | `uk` | Ukrainian |
| `vi` | `vi` | `vi` | Vietnamese |
| `zh-CN` | `zh-cn` | `zh_CN` | Chinese (Simplified) |
| `zh-TW` | `zh-tw` | `zh_TW` | Chinese (Traditional) |

## Observed Developer Hub Split

Observed on the StorePilot AMO edit page on 2026-06-18:

- Default locale: `en-us`.
- Existing locales: `cs`, `de`, `el`, `es-es`, `fi`, `fr`, `hr`, `hu`, `it`, `ja`, `ko`, `nl`, `pl`, `pt-br`, `pt-pt`, `ro`, `ru`, `sk`, `sl`, `sv-se`, `tr`, `uk`, `vi`, `zh-cn`, `zh-tw`.
- New locales available to add: `dsb`, `en-ca`, `en-gb`, `es-ar`, `es-cl`, `es-mx`, `fur`, `fy-nl`, `he`, `hsb`, `ia`, `ka`, `kab`, `nb-no`, `nn-no`, `sq`.

For automation, use the current page state to tell "already added" from "available to add." Do not infer support from the section name alone.

## Common Traps

- Do not call a locale unsupported just because it is absent from Chrome Web Store's visible-language set.
- Do not call an AMO "New Locales" entry unsupported. It is available to add; it is just not an existing translation for that add-on yet.
- Do not treat Mozilla's broader `ALL_LANGUAGES` mapping as the AMO production listing list. The production listing set is narrower.
- Do not assume AMO uses the same locale codes as `_locales` folders. AMO uses hyphens; `_locales` folders use underscores.
- Do not assume Firefox language packs, extension runtime locales, and AMO listing locales are the same thing.
- Do not localize AMO listing text while leaving the extension UI hardcoded in English. For a real localization effort, externalize English UI strings first.
- Do not add regional `_locales` folders with hyphens, such as `_locales/en-US`; use `_locales/en_US`.
- Do not rely on listing translations to prove extension UI localization. They are separate fields.
- Do not strip useful AMO Markdown out of listing descriptions just because Chrome Web Store detailed-description imports avoid headings and labels.

## Release Check

Before releasing a localized Firefox add-on:

- Confirm `manifest.json` has `default_locale` exactly when `_locales/` exists.
- Confirm the `default_locale` folder exists.
- Confirm all locale `messages.json` files have matching keys and placeholder names.
- Confirm no `_locales` folder uses hyphens.
- Confirm AMO listing translations target the AMO production list above or a currently visible Developer Hub language.
- Confirm localized AMO descriptions still render well with AMO's limited Markdown support.
- Confirm right-to-left runtime locales render extension pages and extension-owned injected surfaces correctly.
- Test selected locales in Firefox or Firefox Beta with the relevant language pack.
- Keep AMO listing translations, extension `messages.json`, README/store copy, and release notes conceptually aligned.

## Sources

- [MDN: WebExtensions Internationalization](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Internationalization)
- [MDN: `default_locale`](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/default_locale)
- [Firefox Extension Workshop: Testing localizations](https://extensionworkshop.com/documentation/develop/test-localizations/)
- [Firefox Extension Workshop: Create an appealing listing](https://extensionworkshop.com/documentation/publish/create-an-appealing-listing/)
- [Mozilla addons-server `languages.py`](https://github.com/mozilla/addons-server/blob/master/src/olympia/core/languages.py)
- [Mozilla addons-server production settings](https://github.com/mozilla/addons-server/blob/master/src/olympia/conf/prod/settings.py)
- [Mozilla Discourse: AMO listing localization is separate from extension translations](https://discourse.mozilla.org/t/locales-display-on-amo-store/10574)
