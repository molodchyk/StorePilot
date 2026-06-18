function normalizeLocale(locale) {
  return String(locale || "").replace("-", "_").toLowerCase();
}

function getEquivalentLocales(locale) {
  const normalizedLocale = normalizeLocale(locale);
  const aliases = {
    he: ["iw"],
    iw: ["he"],
    id: ["in"],
    in: ["id"],
    no: ["nb"],
    nb: ["no"]
  };

  return Array.from(new Set([
    normalizedLocale,
    ...(aliases[normalizedLocale] || [])
  ].filter(Boolean)));
}

function localesMatch(left, right) {
  const rightLocales = new Set(getEquivalentLocales(right));
  return getEquivalentLocales(left).some(locale => rightLocales.has(locale));
}

function normalizeLanguageText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePotentialLocaleCode(value) {
  const normalized = normalizeLocale(value);
  return /^[a-z]{2,3}(?:_[a-z0-9]{2,4})?$/.test(normalized) ? normalized : "";
}

function getLocaleDisplayLabels(locale) {
  const normalizedLocale = normalizeLocale(locale);
  const languageTag = normalizedLocale.replace("_", "-");
  const baseLanguage = normalizedLocale.split("_")[0];
  const labels = new Set([normalizedLocale, languageTag, baseLanguage]);

  if (typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function") {
    const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
    [languageTag, baseLanguage].forEach(tag => {
      try {
        const label = displayNames.of(tag);
        if (label) labels.add(label);
      } catch (_error) {
        // Keep code-based labels for locale tags Intl cannot display.
      }
    });
  }

  if (normalizedLocale === "en") {
    labels.add("English Standard");
    labels.add("English (Standard)");
  }

  return Array.from(labels).map(normalizeLanguageText).filter(Boolean);
}

function getListingLocaleKey(locale) {
  const normalized = normalizeLocale(locale);
  return Object.keys(listings).find(key => (
    normalizeLocale(key) === normalized ||
    localesMatch(key, normalized)
  )) || "";
}

function getLocaleFromText(text, localeKeys = Object.keys(listings)) {
  const normalizedText = normalizeLocale(text);
  const sortedLocaleKeys = [...localeKeys].sort((a, b) => b.length - a.length);

  for (const locale of sortedLocaleKeys) {
    const localeMatches = getEquivalentLocales(locale).sort((a, b) => b.length - a.length);

    for (const normalizedLocale of localeMatches) {
      const escaped = normalizedLocale.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");

      if (pattern.test(normalizedText)) {
        return locale;
      }
    }
  }

  const normalizedLanguageText = normalizeLanguageText(text);
  const labelMatches = sortedLocaleKeys
    .flatMap(locale => getLocaleDisplayLabels(locale).map(label => ({ locale, label })))
    .sort((a, b) => b.label.length - a.label.length);

  for (const match of labelMatches) {
    const escaped = match.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^| )${escaped}( |$)`, "i");

    if (pattern.test(normalizedLanguageText)) {
      return match.locale;
    }
  }

  return "";
}

function isLikelyLanguageText(text) {
  return /^(language|sprache|langue|idioma|lingua|言語|语言)$/i.test(text.trim());
}

function containsLikelyLanguageText(text) {
  return /\b(language|sprache|langue|idioma|lingua)\b|言語|语言/i.test(String(text || ""));
}

function getElementLocale(element, localeKeys = Object.keys(listings)) {
  if (!element) return "";

  const attributeValues = [
    element.getAttribute("data-value"),
    element.getAttribute("value"),
    element.getAttribute("aria-label")
  ].filter(Boolean);

  for (const value of attributeValues) {
    const locale = normalizePotentialLocaleCode(value);
    if (locale) return locale;
  }

  return getLocaleFromText(getVisibleText(element), localeKeys);
}
