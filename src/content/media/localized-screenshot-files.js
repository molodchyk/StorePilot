function getLocalizedScreenshotFileEntries(files) {
  return Object.entries(files && files.localizedScreenshots || {})
    .map(([locale, localeFiles]) => ({
      locale,
      files: Array.from(localeFiles || []).filter(Boolean).slice(0, MAX_DASHBOARD_SCREENSHOTS)
    }))
    .filter(entry => entry.locale && entry.files.length)
    .sort((a, b) => a.locale.localeCompare(b.locale));
}

function applyLocalizedScreenshotStartLocale(entries, startLocale) {
  const normalizedStartLocale = normalizeLocale(startLocale);
  if (!normalizedStartLocale) {
    return {
      ok: true,
      entries,
      skippedBeforeStart: []
    };
  }

  const startIndex = entries.findIndex(entry => localesMatch(entry.locale, normalizedStartLocale));
  if (startIndex < 0) {
    return {
      ok: false,
      entries: [],
      skippedBeforeStart: [],
      message: `start locale ${startLocale} was not found in localized screenshot files`
    };
  }

  return {
    ok: true,
    entries: entries.slice(startIndex),
    skippedBeforeStart: startIndex > 0
      ? [`${startIndex} locale(s) before start locale ${startLocale}`]
      : []
  };
}

function normalizeLocalizedScreenshotAssignedLocales(assignedLocales) {
  if (!Array.isArray(assignedLocales)) return [];

  const seen = new Set();
  const normalized = [];
  for (const locale of assignedLocales) {
    const normalizedLocale = normalizeLocale(locale);
    if (!normalizedLocale || seen.has(normalizedLocale)) continue;
    seen.add(normalizedLocale);
    normalized.push(normalizedLocale);
  }
  return normalized;
}

function applyLocalizedScreenshotAssignedLocales(entries, assignedLocales) {
  const normalizedAssignedLocales = normalizeLocalizedScreenshotAssignedLocales(assignedLocales);
  const assignedSet = new Set(normalizedAssignedLocales);
  const filteredEntries = entries.filter(entry => assignedSet.has(normalizeLocale(entry.locale)));
  const foundLocales = new Set(filteredEntries.map(entry => normalizeLocale(entry.locale)));
  const missingAssignedLocales = normalizedAssignedLocales
    .filter(locale => !foundLocales.has(locale))
    .map(locale => `${locale}: assigned locale has no localized screenshot files`);

  return {
    entries: filteredEntries,
    skippedAssignedLocales: missingAssignedLocales,
    assignedLocales: normalizedAssignedLocales
  };
}

function normalizeLocalizedScreenshotOperation(value) {
  return [
    LOCALIZED_SCREENSHOT_OPERATION_REPLACE,
    LOCALIZED_SCREENSHOT_OPERATION_CLEAR_ONLY,
    LOCALIZED_SCREENSHOT_OPERATION_UPLOAD_ONLY
  ].includes(value)
    ? value
    : LOCALIZED_SCREENSHOT_OPERATION_REPLACE;
}

function countLocalizedScreenshotSkippedLocales(skipped) {
  return skipped.reduce((count, item) => {
    const match = String(item || "").match(/^(\d+) locale\(s\) before start locale\b/);
    return count + (match ? Number(match[1]) : 1);
  }, 0);
}

async function resolveLocalizedScreenshotUploadTarget(currentTarget) {
  if (currentTarget && currentTarget.input && currentTarget.input.isConnected) {
    return currentTarget;
  }

  return waitForAvailableMediaUploadInput("localizedScreenshots");
}

