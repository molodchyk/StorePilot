function storePilotGetLocaleFromFileName(fileName) {
  const name = fileName.replace(/\.[^.]+$/i, "");
  const match = name.match(/^([a-z]{2,3})(?:[-_]([a-z0-9]{2,4}))?$/i);

  if (!match) {
    return null;
  }

  const language = match[1].toLowerCase();
  const region = match[2] ? match[2].toUpperCase() : "";
  return region ? `${language}_${region}` : language;
}

function storePilotIsChromeWebStoreSupportedLocale(locale) {
  return STOREPILOT_CHROME_WEB_STORE_SUPPORTED_LOCALES.has(String(locale || "").replace("-", "_"));
}

function storePilotGetUnsupportedChromeWebStoreLocales(listings) {
  return Object.keys(listings || {})
    .filter(locale => !storePilotIsChromeWebStoreSupportedLocale(locale))
    .sort((a, b) => a.localeCompare(b));
}

function storePilotGetFileExtension(fileName) {
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function storePilotIsPotentialListingFile(file, options = {}) {
  const allowUnknownText = options.allowUnknownText !== false;
  const locale = storePilotGetLocaleFromFileName(file.name);
  const extension = storePilotGetFileExtension(file.name);

  if (!locale) return false;
  if (STOREPILOT_TEXT_LISTING_EXTENSIONS.has(extension)) return true;
  if (STOREPILOT_BLOCKED_LISTING_EXTENSIONS.has(extension)) return false;
  if (!allowUnknownText) return false;

  return !file.size || file.size <= 512 * 1024;
}

function storePilotShouldSkipDirectory(directoryName) {
  return STOREPILOT_SKIPPED_DIRECTORY_NAMES.has(directoryName.toLowerCase());
}

function storePilotGetRelativePathParts(file) {
  const relativePath = file.webkitRelativePath || file.relativePath || file.name;
  return relativePath.split(/[\\/]+/).filter(Boolean);
}

function storePilotHasSkippedPathPart(pathParts) {
  return pathParts.some(part => storePilotShouldSkipDirectory(part));
}
