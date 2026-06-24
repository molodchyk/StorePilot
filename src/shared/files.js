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

function storePilotGetFileExtension(fileName) {
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function storePilotNormalizeStoreDraftPathPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function storePilotIsPotentialStoreListingDraftPath(pathParts) {
  const parts = Array.from(pathParts || []).filter(Boolean);
  const fileName = parts[parts.length - 1] || "";
  const extension = storePilotGetFileExtension(fileName);

  if (!STOREPILOT_TEXT_LISTING_EXTENSIONS.has(extension)) return false;
  if (storePilotGetLocaleFromFileName(fileName)) return false;

  const normalizedParts = parts.map(storePilotNormalizeStoreDraftPathPart);
  const baseName = storePilotNormalizeStoreDraftPathPart(fileName.replace(/\.[^.]+$/i, ""));
  const parentParts = normalizedParts.slice(0, -1);
  const hasStorePath = parentParts.some(part => (
    part === "chrome-web-store" ||
    part === "web-store" ||
    part === "store-listing" ||
    part === "store-listings" ||
    part === "metadata"
  ));
  const inDocs = parentParts.some(part => part === "docs" || part === "documentation");

  if ([
    "chrome-web-store",
    "chrome-web-store-draft",
    "chrome-web-store-listing",
    "store-listing",
    "store-description",
    "web-store-listing"
  ].includes(baseName)) {
    return true;
  }

  if (hasStorePath && /(listing|description|draft|chrome-web-store|web-store)/.test(baseName)) {
    return true;
  }

  return inDocs && /(chrome-web-store|web-store)/.test(baseName);
}

function storePilotNormalizeMarkdownHeading(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[`*_]+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function storePilotExtractMarkdownSection(text, wantedHeadings) {
  const normalizedWanted = new Set(wantedHeadings.map(storePilotNormalizeMarkdownHeading));
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");

  for (let index = 0; index < lines.length; index++) {
    const heading = lines[index].match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!heading || !normalizedWanted.has(storePilotNormalizeMarkdownHeading(heading[2]))) {
      continue;
    }

    const level = heading[1].length;
    const sectionLines = [];

    for (let sectionIndex = index + 1; sectionIndex < lines.length; sectionIndex++) {
      const nextHeading = lines[sectionIndex].match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (nextHeading && nextHeading[1].length <= level) {
        break;
      }
      sectionLines.push(lines[sectionIndex]);
    }

    return sectionLines.join("\n").trim();
  }

  return "";
}

function storePilotLooksLikeStoreListingDraftText(text) {
  const normalized = String(text || "").toLowerCase();
  const hasDraftHeading = /^#{1,6}\s+chrome web store\b/im.test(text);
  const hasListingSections = [
    /^#{1,6}\s+name\b/im,
    /^#{1,6}\s+short description\b/im,
    /^#{1,6}\s+detailed description\b/im,
    /^#{1,6}\s+image assets\b/im,
    /^#{1,6}\s+permission justification\b/im
  ].filter(pattern => pattern.test(text)).length;

  return (
    (hasDraftHeading && hasListingSections >= 2) ||
    (/\bchrome web store\b/.test(normalized) && hasListingSections >= 3)
  );
}

function storePilotExtractStoreListingDraftText(text) {
  const detailedDescription = storePilotExtractMarkdownSection(text, [
    "Detailed Description",
    "Full Description",
    "Long Description",
    "Store Description"
  ]);

  if (detailedDescription) return detailedDescription;

  const description = storePilotExtractMarkdownSection(text, ["Description"]);
  if (description) return description;

  return String(text || "").trim();
}

function storePilotCreateStoreListingDraftCandidate(file, pathParts, text) {
  if (!storePilotIsPotentialStoreListingDraftPath(pathParts)) return null;
  if (!storePilotLooksLikeStoreListingDraftText(text)) return null;

  const listingText = storePilotExtractStoreListingDraftText(text);
  if (!listingText) return null;

  return {
    name: "en.txt",
    sourceName: file.name,
    sourcePath: pathParts.join("/"),
    listingLocale: "en",
    listingKind: "storeDraft",
    sample: listingText.slice(0, 4000),
    async text() {
      return listingText;
    }
  };
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
