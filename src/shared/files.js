function storePilotGetLocaleFromFileName(fileName) {
  const name = fileName.replace(/\.[^.]+$/i, "");

  if (!/^[a-z]{2,3}(?:_[A-Z0-9]{2,4})?$/.test(name)) {
    return null;
  }

  return name;
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
